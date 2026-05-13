import fs from "fs/promises";
import path from "path";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type EmailDeliveryResult = {
  delivered: boolean;
  mode: "postmark" | "sendgrid" | "outbox_fallback";
  providerId?: string | null;
};

const EMAIL_OUTBOX_PATH = path.join(process.cwd(), ".local", "email-outbox.jsonl");

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
  const postmarkEnabled = Boolean(String(process.env.POSTMARK_SERVER_TOKEN || "").trim());
  const sendgridEnabled = Boolean(String(process.env.SENDGRID_API_KEY || "").trim());

  try {
    if (postmarkEnabled) {
      return await sendWithPostmark(message);
    }
    if (sendgridEnabled) {
      return await sendWithSendGrid(message);
    }
  } catch (error) {
    await appendOutbox({
      queuedAt: new Date().toISOString(),
      deliveryMode: "outbox_fallback",
      reason: error instanceof Error ? error.message : String(error),
      ...message,
    });
    return { delivered: false, mode: "outbox_fallback", providerId: null };
  }

  await appendOutbox({
    queuedAt: new Date().toISOString(),
    deliveryMode: "outbox_fallback",
    reason: "No ESP provider configured",
    ...message,
  });
  return { delivered: false, mode: "outbox_fallback", providerId: null };
}
