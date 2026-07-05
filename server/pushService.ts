import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { pushSubscriptions, type InsertPushSubscription } from "@shared/schema";

// Web Push (OS-level notifications, even when the app is closed).
//
// Push is "on" only when BOTH VAPID keys are present in env — no keys = silent
// no-op, so callers never have to guard. Generate a keypair with:
//   node -e "console.log(require('web-push').generateVAPIDKeys())"
// Public key → client (safe to ship). Private key → secret env, NEVER committed.
const PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
// Contact the push service can reach if a notification misbehaves (spec-required).
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@kiddofund.com";

let configured = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  } catch (e) {
    console.warn("[push] VAPID config failed:", (e as Error).message);
  }
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getPushPublicKey(): string {
  return PUBLIC;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Store (or refresh) a browser subscription. endpoint is unique → upsert so
// re-subscribing the same device never duplicates rows.
export async function storeSubscription(
  userId: string,
  sub: BrowserSubscription,
  userAgent?: string,
): Promise<void> {
  const row: InsertPushSubscription = {
    userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent: userAgent ?? null,
  };
  await db
    .insert(pushSubscriptions)
    .values(row)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: row.p256dh, auth: row.auth, lastUsedAt: new Date() },
    });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

// Deliver a push to EVERY device a user has opted in on. Dead endpoints
// (404 Not Found / 410 Gone) are pruned automatically. Silent no-op when push
// isn't configured, so feature code can call this unconditionally.
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number; failed: number }> {
  if (!configured) return { sent: 0, pruned: 0, failed: 0 };
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  let pruned = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await removeSubscription(s.endpoint).catch(() => {});
          pruned++;
        } else {
          failed++;
          console.warn("[push] send failed:", code, e?.message);
        }
      }
    }),
  );
  return { sent, pruned, failed };
}
