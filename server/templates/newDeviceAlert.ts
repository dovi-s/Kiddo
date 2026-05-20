// New device sign-in alert. Fires the first time a fingerprint
// (IP /24 + UA family) appears for a user. Subsequent logins from
// the same fingerprint are silent.
//
// Tone: factual, not alarmist. Most new-device sign-ins are the
// user themselves on a new browser, phone, or coffee-shop laptop.
// The point is to give them the data so THEY can recognize whether
// it was them. Heavy "SECURITY ALERT 🚨" framing would train them
// to dismiss legitimate alerts.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type NewDeviceAlertInput = {
  to: string;
  firstName?: string | null;
  // Display-friendly fields. The actual IP can be redacted /
  // truncated for the user-facing copy if it's noisy.
  approxLocation?: string | null;
  device?: string | null;
  signedInAt: Date;
  resetUrl: string;
};

export function buildNewDeviceAlertEmail(input: NewDeviceAlertInput): EmailMessage {
  const { to, firstName, approxLocation, device, signedInAt, resetUrl } = input;
  const greeting = firstName && firstName.trim() ? `Hi ${firstName.trim()},` : "Hi there,";
  const whenStr = signedInAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const locationLine = approxLocation ? `Approximate location: ${approxLocation}\n` : "";
  const deviceLine = device ? `Device: ${device}\n` : "";

  const intro = [
    greeting,
    ``,
    `Someone just signed into your Kiddo account from a device we don't recognize.`,
    ``,
    `When: ${whenStr}`,
    `${locationLine}${deviceLine}`,
    `If that was you, no action needed. We'll remember this device going forward.`,
    ``,
    `If it wasn't you, reset your password immediately. The link below signs you out of every other session at the same time.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: "New device signed in",
    intro,
    cta: { text: "Reset password", url: resetUrl },
    postscript: "If you keep getting these alerts unexpectedly, write to support and we'll lock the account down.",
  });

  const text = [
    greeting,
    ``,
    `Someone just signed into your Kiddo account from a device we don't recognize.`,
    ``,
    `When: ${whenStr}`,
    approxLocation ? `Approximate location: ${approxLocation}` : null,
    device ? `Device: ${device}` : null,
    ``,
    `If that was you, no action needed. We'll remember this device going forward.`,
    ``,
    `If it wasn't you, reset your password immediately:`,
    resetUrl,
    ``,
    `The Kiddo team`,
  ].filter(Boolean).join("\n");

  return {
    to,
    subject: "New device signed into your Kiddo account",
    text,
    html,
    tags: ["new-device-alert"],
    metadata: { kind: "new_device_alert" },
  };
}
