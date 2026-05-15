import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { isEmailSuppressed } from "./postmarkWebhook";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // Optional unsubscribe URL for non-transactional emails. When set:
  //   - The HTML body's footer should already include a visible
  //     unsubscribe link (renderKiddoEmail's unsubscribeUrl arg).
  //   - sendEmail() adds the RFC 8058 List-Unsubscribe header so
  //     Gmail / Outlook / Fastmail render their native unsubscribe
  //     button. This is now required by Gmail and Yahoo for senders
  //     above 5k/day; cheap to set on every promotional email.
  //   - sendEmail() also adds List-Unsubscribe-Post for one-click
  //     unsub via POST (also part of RFC 8058).
  // Transactional emails (password reset, verification, large-gift
  // verification) DO NOT set this. They're not promotional and have
  // no opt-out concept.
  listUnsubscribeUrl?: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
  mode: "postmark" | "sendgrid" | "outbox_fallback" | "dedupe_skipped" | "suppressed";
  providerId?: string | null;
};

const EMAIL_OUTBOX_PATH = path.join(process.cwd(), ".local", "email-outbox.jsonl");

// In-process dedupe cache. Maps (canonical payload hash) -> sentAt epoch.
// This is the SAFETY NET, not the primary dedupe layer. Each worker
// (gifter, parent-lifecycle, recurring) already maintains its own
// queue/delivery log to prevent re-sending. The cache here catches the
// remaining cases:
//   - Webhook handler retries that re-trigger the same email path
//     before the per-worker delivery log catches up
//   - Race conditions during worker tick overlap
//   - Code paths that bypass worker queues entirely (one-off sends from
//     route handlers, password resets, etc.)
// In-memory is intentional. The cache lasts the lifetime of the Node
// process; on restart the window resets, which is fine because the
// per-worker delivery logs persist (file-backed JSON / DB activity
// rows) and own the long-term dedupe responsibility.
const DEDUPE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const DEDUPE_MAX_ENTRIES = 5000; // cap memory; LRU-ish via timestamp prune

type DedupeEntry = { sentAt: number; mode: EmailDeliveryResult["mode"] };
const dedupeCache = new Map<string, DedupeEntry>();

function computeDedupeKey(message: EmailMessage): string {
  // Canonical payload: lowercased recipient, exact subject, exact text body,
  // and first tag if present. HTML body excluded because text body is the
  // semantic signal; html is just a styled mirror. Metadata excluded
  // because it often carries timestamps that would defeat dedupe.
  const tag = Array.isArray(message.tags) && message.tags.length > 0 ? message.tags[0] : "";
  const canonical = [
    String(message.to || "").trim().toLowerCase(),
    String(message.subject || ""),
    String(message.text || ""),
    tag,
  ].join("\n--KIDDO-DEDUPE--\n");
  return crypto.createHash("sha1").update(canonical).digest("hex");
}

function pruneExpiredDedupe(now: number) {
  // Lazy cleanup. Runs at most once per send call, walks the map
  // dropping anything past TTL. Also enforces the size cap by
  // dropping oldest if we somehow exceed the limit (defensive).
  // Array.from for iteration to avoid downlevel-iteration requirements
  // on older tsconfig targets that may still apply here.
  const expired: string[] = [];
  Array.from(dedupeCache.entries()).forEach(([k, v]) => {
    if (now - v.sentAt > DEDUPE_TTL_MS) expired.push(k);
  });
  for (const k of expired) dedupeCache.delete(k);

  if (dedupeCache.size > DEDUPE_MAX_ENTRIES) {
    // Sort by sentAt asc, drop until under cap.
    const entries = Array.from(dedupeCache.entries()).sort(
      (a, b) => a[1].sentAt - b[1].sentAt,
    );
    const dropCount = dedupeCache.size - DEDUPE_MAX_ENTRIES;
    for (let i = 0; i < dropCount; i += 1) {
      dedupeCache.delete(entries[i][0]);
    }
  }
}

function getFromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SUPPORT_EMAIL ||
    "support@kiddofund.com"
  );
}

async function appendOutbox(payload: Record<string, unknown>) {
  await fs.mkdir(path.dirname(EMAIL_OUTBOX_PATH), { recursive: true });
  await fs.appendFile(EMAIL_OUTBOX_PATH, JSON.stringify(payload) + "\n", "utf8");
}

async function sendWithPostmark(message: EmailMessage): Promise<EmailDeliveryResult> {
  const token = String(process.env.POSTMARK_SERVER_TOKEN || "").trim();
  if (!token) throw new Error("POSTMARK_SERVER_TOKEN missing");

  // RFC 8058 one-click List-Unsubscribe. Set BOTH headers when the
  // caller provides an unsubscribe URL; Postmark passes them through
  // verbatim. Gmail / Outlook / Fastmail render the native unsub
  // button when both are present.
  const headers: Array<{ Name: string; Value: string }> = [];
  if (message.listUnsubscribeUrl) {
    headers.push({ Name: "List-Unsubscribe", Value: `<${message.listUnsubscribeUrl}>` });
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" });
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: getFromAddress(),
      To: message.to,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || "outbound",
      Metadata: message.metadata,
      Tag: Array.isArray(message.tags) && message.tags.length > 0 ? message.tags[0] : undefined,
      Headers: headers.length > 0 ? headers : undefined,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Postmark send failed (${response.status}): ${detail}`);
  }

  const payload: any = await response.json();
  return {
    delivered: true,
    mode: "postmark",
    providerId: payload?.MessageID || null,
  };
}

async function sendWithSendGrid(message: EmailMessage): Promise<EmailDeliveryResult> {
  const token = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!token) throw new Error("SENDGRID_API_KEY missing");

  const content = [{ type: "text/plain", value: message.text }];
  if (message.html) content.push({ type: "text/html", value: message.html });

  // SendGrid headers go on the personalization OR top-level. List-
  // Unsubscribe lives top-level so it covers the single recipient.
  const sendgridHeaders: Record<string, string> = {};
  if (message.listUnsubscribeUrl) {
    sendgridHeaders["List-Unsubscribe"] = `<${message.listUnsubscribeUrl}>`;
    sendgridHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: getFromAddress() },
      personalizations: [
        {
          to: [{ email: message.to }],
          subject: message.subject,
          custom_args: message.metadata,
        },
      ],
      content,
      categories: message.tags,
      ...(Object.keys(sendgridHeaders).length > 0 ? { headers: sendgridHeaders } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SendGrid send failed (${response.status}): ${detail}`);
  }

  return {
    delivered: true,
    mode: "sendgrid",
    providerId: response.headers.get("x-message-id"),
  };
}

export async function sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
  // Suppression pre-flight. Hard-bounce + spam-complaint addresses
  // are stored in the email_suppressions table by the ESP webhook
  // handler (server/postmarkWebhook.ts). Sending to a suppressed
  // address would compound sender-reputation damage and re-trigger
  // the same bounce. Silent skip — the caller's worker layer is
  // responsible for not re-queueing if delivered=false matters.
  // Locked 2026-05-15 as part of the deliverability-hygiene branch.
  if (await isEmailSuppressed(message.to)) {
    return { delivered: false, mode: "suppressed", providerId: null };
  }

  // Dedupe safety net. Check before doing any provider work. If we
  // would re-send the exact same payload to the exact same recipient
  // within the TTL window, skip. Each per-worker layer already has its
  // own dedupe; this catches the cracks (webhook retries, race
  // conditions, route-handler one-offs that bypass worker queues).
  const now = Date.now();
  pruneExpiredDedupe(now);
  const dedupeKey = computeDedupeKey(message);
  const prior = dedupeCache.get(dedupeKey);
  if (prior && now - prior.sentAt < DEDUPE_TTL_MS) {
    return { delivered: false, mode: "dedupe_skipped", providerId: null };
  }

  const postmarkEnabled = Boolean(String(process.env.POSTMARK_SERVER_TOKEN || "").trim());
  const sendgridEnabled = Boolean(String(process.env.SENDGRID_API_KEY || "").trim());

  try {
    if (postmarkEnabled) {
      const result = await sendWithPostmark(message);
      dedupeCache.set(dedupeKey, { sentAt: now, mode: result.mode });
      return result;
    }
    if (sendgridEnabled) {
      const result = await sendWithSendGrid(message);
      dedupeCache.set(dedupeKey, { sentAt: now, mode: result.mode });
      return result;
    }
  } catch (error) {
    await appendOutbox({
      queuedAt: new Date().toISOString(),
      deliveryMode: "outbox_fallback",
      reason: error instanceof Error ? error.message : String(error),
      ...message,
    });
    // Stamp dedupe even for outbox fallback. Otherwise a transient ESP
    // failure that retried via outbox would re-attempt provider sends
    // on every subsequent call, all hitting the same error, all
    // appending to the outbox. The cache entry says "we tried this
    // payload recently; give it some breathing room before trying
    // again." Real retry should come from operating on the outbox file
    // out-of-band, not from rapid-fire repeats here.
    dedupeCache.set(dedupeKey, { sentAt: now, mode: "outbox_fallback" });
    return { delivered: false, mode: "outbox_fallback", providerId: null };
  }

  await appendOutbox({
    queuedAt: new Date().toISOString(),
    deliveryMode: "outbox_fallback",
    reason: "No ESP provider configured",
    ...message,
  });
  dedupeCache.set(dedupeKey, { sentAt: now, mode: "outbox_fallback" });
  return { delivered: false, mode: "outbox_fallback", providerId: null };
}
