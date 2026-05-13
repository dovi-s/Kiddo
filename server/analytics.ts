// First-party product analytics. Server-side only. No third-party
// tracking pixels, no kid data shipped off-platform.
//
// Design contract:
// - `recordEvent` is fire-and-forget. Errors are swallowed and logged
//   to console; analytics writes never block or fail a request path.
// - Callers do NOT await this function. Use it as
//   `recordEvent({ ... })` (no await), and the unawaited promise will
//   resolve on its own. This also keeps the route hot-path clean.
// - The event-name space is small and stable. New names go in
//   `KnownEventName` so we have a single source of truth and grep target.
// - Props payload is small. Anything heavyweight belongs in audit_logs
//   or its own table, not here.

import type { Request } from "express";
import { db } from "./db";
import { analyticsEvents } from "@shared/schema";

export type KnownEventName =
  | "signup"
  | "fund_created"
  | "share_link_visited"
  | "gift_started"
  | "gift_completed"
  // The set is intentionally narrow today. Extend by adding the
  // string literal here AND wiring a single `recordEvent` call at
  // the right point in the request path.
  ;

export type EventSource = "web" | "mobile" | "webhook" | "public";

export type RecordEventInput = {
  name: KnownEventName | string;
  userId?: string | null;
  fundId?: string | null;
  sessionId?: string | null;
  source?: EventSource;
  props?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

export function recordEvent(input: RecordEventInput): void {
  // Fire-and-forget. We do not await; we do not return the promise.
  // Wrapped in a setImmediate so even synchronous validation errors
  // (e.g. malformed input) don't bubble into the calling function's
  // error handling.
  setImmediate(() => {
    void writeEvent(input).catch((err) => {
      console.warn(`[analytics] failed to record ${input.name}:`, err?.message || err);
    });
  });
}

async function writeEvent(input: RecordEventInput): Promise<void> {
  await db.insert(analyticsEvents).values({
    eventName: String(input.name).slice(0, 64),
    userId: input.userId || null,
    fundId: input.fundId || null,
    sessionId: input.sessionId ? String(input.sessionId).slice(0, 128) : null,
    source: input.source || null,
    props: input.props && typeof input.props === "object" ? input.props : null,
    ipAddress: input.ip ? String(input.ip).slice(0, 64) : null,
    userAgent: input.userAgent ? String(input.userAgent).slice(0, 512) : null,
  });
}

// Convenience: pull request-scoped fields from an Express request so
// callers don't have to plumb ip/userAgent/sessionId every time.
export function eventCtxFromReq(req: Request): {
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  userId: string | null;
} {
  const xff = (req.headers["x-forwarded-for"] || "") as string;
  const ip = (xff.split(",")[0] || req.ip || (req.socket as any)?.remoteAddress || "").trim() || null;
  const userAgent = (req.headers["user-agent"] as string) || null;
  const sessionId = (req as any).sessionID || null;
  const userId = (req as any).user?.id || null;
  return { ip, userAgent, sessionId, userId };
}
