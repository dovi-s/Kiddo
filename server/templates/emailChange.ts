// Email-change confirmation + revocation templates. Pair of emails
// sent when a user requests an email change:
//   - Confirmation: to the NEW address. Clicking commits the swap.
//   - Heads-up + revoke: to the OLD address. Clicking cancels + locks.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type EmailChangeConfirmInput = {
  to: string; // the NEW address
  firstName?: string | null;
  newEmail: string;
  confirmUrl: string;
};

export function buildEmailChangeConfirmEmail(input: EmailChangeConfirmInput): EmailMessage {
  const { to, firstName, newEmail, confirmUrl } = input;
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi there,";
  const intro = [
    greeting,
    ``,
    `Someone (probably you) asked to change a Kiddo account's email address to ${newEmail}.`,
    ``,
    `Confirm this is your address by tapping below. The change goes through after you confirm. The link is good for 24 hours.`,
    ``,
    `If you didn't request this, ignore this email. The change won't happen without confirmation.`,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: "Confirm your new Kiddo email",
    intro,
    cta: { text: "Confirm email change", url: confirmUrl },
  });
  const text = [
    greeting,
    ``,
    `Someone (probably you) asked to change a Kiddo account's email address to ${newEmail}.`,
    ``,
    `Confirm this is your address (good for 24 hours):`,
    confirmUrl,
    ``,
    `If you didn't request this, ignore this email. The change won't happen without confirmation.`,
    ``,
    `The Kiddo team`,
  ].join("\n");
  return {
    to,
    subject: "Confirm your new Kiddo email",
    text,
    html,
    tags: ["email-change-confirm"],
    metadata: { kind: "email_change_confirm" },
  };
}

export type EmailChangeHeadsUpInput = {
  to: string; // the OLD address
  firstName?: string | null;
  newEmail: string;
  revokeUrl: string;
  requestIpHint?: string | null;
};

export function buildEmailChangeHeadsUpEmail(input: EmailChangeHeadsUpInput): EmailMessage {
  const { to, firstName, newEmail, revokeUrl, requestIpHint } = input;
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi there,";
  const ipLine = requestIpHint ? `\n\nThe request came from ${requestIpHint}.` : "";
  const intro = [
    greeting,
    ``,
    `Someone requested to change your Kiddo account's email address to ${newEmail}.`,
    ``,
    `If that was you, no action needed. The change goes through once the new address is confirmed (we sent a separate email there).`,
    ``,
    `If that WASN'T you, tap below to cancel the change and lock the account. The link is good for 24 hours.${ipLine}`,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: "Email change requested on your Kiddo account",
    intro,
    cta: { text: "Cancel email change", url: revokeUrl },
    postscript: "If you keep getting these without asking, reply to this email and we'll lock the account down.",
  });
  const text = [
    greeting,
    ``,
    `Someone requested to change your Kiddo account's email address to ${newEmail}.`,
    ``,
    `If that was you, no action needed.`,
    ``,
    `If that WASN'T you, cancel the change (good for 24 hours):`,
    revokeUrl,
    requestIpHint ? `\nThe request came from ${requestIpHint}.` : null,
    ``,
    `The Kiddo team`,
  ].filter(Boolean).join("\n");
  return {
    to,
    subject: "Heads up: email change requested on your Kiddo account",
    text,
    html,
    tags: ["email-change-headsup"],
    metadata: { kind: "email_change_headsup" },
  };
}
