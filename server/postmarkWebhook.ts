// Postmark webhook handler.
//
// Postmark fires this endpoint when a delivery event matches one
// of the subscribed RecordTypes. We subscribe to Bounce and
// SpamComplaint. Other RecordTypes (Open, Click, Delivery) get
// acked but no action.
//
// Mounted at POST /api/webhooks/postmark. Configured on Postmark's
// side under Server > Settings > Webhooks. ALSO needs basic-auth
// credentials set in Postmark's webhook config matching our
// POSTMARK_WEBHOOK_USER / POSTMARK_WEBHOOK_PASS env vars — without
// the env vars set on our side, all webhook requests are rejected.
// This protects against a forged webhook from a public endpoint
// scanner writing arbitrary entries to our suppression list.
//
// On Bounce (Type === "HardBounce") or SpamComplaint, we upsert
// into email_suppressions with the appropriate reason. The unique
// constraint on (email, reason) makes re-fires idempotent.
//
// Always returns 200 to Postmark — even on internal errors. A non-2xx
// response triggers Postmark's retry logic, which would compound
// transient DB issues into a webhook storm. We log internally and
// rely on the per-ESP suppression as a backstop if our local list
// fails to write.

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { emailSuppressions } from "@shared/schema";
import { sql } from "drizzle-orm";

type PostmarkBounceEvent = {
  RecordType: "Bounce";
  Type?: string;
  Email?: string;
  Description?: string;
  Details?: string;
  ServerID?: number;
  MessageID?: string;
  MessageStream?: string;
  BouncedAt?: string;
};

type PostmarkSpamComplaintEvent = {
  RecordType: "SpamComplaint";
  Email?: string;
  MessageID?: string;
  MessageStream?: string;
  BouncedAt?: string;
};

type PostmarkWebhookEvent =
  | PostmarkBounceEvent
  | PostmarkSpamComplaintEvent
  | { RecordType: string; [key: string]: unknown };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function verifyBasicAuth(req: Request): boolean {
  const expectedUser = String(process.env.POSTMARK_WEBHOOK_USER || "").trim();
  const expectedPass = String(process.env.POSTMARK_WEBHOOK_PASS || "").trim();
  // Without both env vars set, refuse all requests. Beats accidentally
  // allowing a wide-open endpoint in dev / staging.
  if (!expectedUser || !expectedPass) return false;
  const header = req.get("authorization") || "";
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/.exec(header);
  if (!match) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  const user = decoded.slice(0, colon);
  const pass = decoded.slice(colon + 1);
  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
}

async function suppressEmail(opts: {
  email: string;
  reason: "hard_bounce" | "spam_complaint";
  payload: unknown;
}): Promise<void> {
  const normalized = String(opts.email || "").trim().toLowerCase();
  if (!normalized) return;
  // ON CONFLICT DO NOTHING: re-firing the same (email, reason) is
  // a no-op. Keeps the worker idempotent and avoids spurious
  // updated_at-style churn.
  await db
    .insert(emailSuppressions)
    .values({
      email: normalized,
      reason: opts.reason,
      source: "postmark",
      payload: opts.payload as any,
    })
    .onConflictDoNothing({
      target: [emailSuppressions.email, emailSuppressions.reason],
    });
}

export function registerPostmarkWebhook(app: Express): void {
  app.post("/api/webhooks/postmark", async (req: Request, res: Response) => {
    if (!verifyBasicAuth(req)) {
      // Don't 401 here — that tells a probing attacker the endpoint
      // exists and basic-auth is the gate. 404 is the less-useful
      // shape from a recon perspective. Postmark will retry on
      // 4xx/5xx, but a permanent 404 in the dashboard is the
      // signal an operator notices.
      return res.status(404).json({ error: "Not found" });
    }

    const body = req.body as PostmarkWebhookEvent | PostmarkWebhookEvent[];
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      try {
        if (!event || typeof event !== "object") continue;
        if (event.RecordType === "Bounce") {
          const e = event as PostmarkBounceEvent;
          // Only HardBounce is a permanent failure. SoftBounce
          // (mailbox full, server timeout, etc.) is transient;
          // suppressing on soft would unfairly punish legitimate
          // recipients.
          if (e.Type === "HardBounce" && e.Email) {
            await suppressEmail({
              email: e.Email,
              reason: "hard_bounce",
              payload: e,
            });
            console.log(`[postmark-webhook] suppressed hard_bounce ${e.Email}`);
          }
        } else if (event.RecordType === "SpamComplaint") {
          const e = event as PostmarkSpamComplaintEvent;
          if (e.Email) {
            await suppressEmail({
              email: e.Email,
              reason: "spam_complaint",
              payload: e,
            });
            console.log(`[postmark-webhook] suppressed spam_complaint ${e.Email}`);
          }
        }
        // All other RecordTypes (Delivery, Open, Click, etc.) get
        // a silent 200 ack. We don't currently track them.
      } catch (err: any) {
        // Log but don't surface — see top-of-file note about returning
        // 200 even on internal errors to prevent retry storms.
        console.error("[postmark-webhook] event handler error:", err?.message || err);
      }
    }

    return res.status(200).json({ ok: true, processed: events.length });
  });
}

// Used by sendEmail() to check whether an address is on the
// suppression list before attempting delivery. Returns true if any
// active (non-unsuppressed) row exists for the address. Lowercase
// + trim the input so we match the normalized storage form.
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  try {
    const rows = await db.execute(sql`
      SELECT 1
        FROM email_suppressions
       WHERE email = ${normalized}
         AND (unsuppressed_at IS NULL OR unsuppressed_at > NOW())
       LIMIT 1
    `);
    return Array.isArray((rows as any).rows)
      ? (rows as any).rows.length > 0
      : Array.isArray(rows)
        ? (rows as any).length > 0
        : false;
  } catch (err: any) {
    // If the suppression check itself fails, fail OPEN. A DB hiccup
    // shouldn't block legitimate sends. The ESP-side suppression
    // (Postmark's own list) is still in effect as a backstop.
    console.warn("[email-suppression] lookup failed, allowing send:", err?.message || err);
    return false;
  }
}
