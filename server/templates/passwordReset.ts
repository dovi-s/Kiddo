// Password reset email. First consumer of the renderKiddoEmail
// branded helper. Sent when a parent (or any account holder) hits
// /api/auth/forgot-password with an email that matches a real user.
//
// Security notes:
//   - The token in the URL is the RAW token; the DB stores SHA-256(token).
//     This file builds the URL; the route handler stamps the hash.
//   - We deliberately don't disclose whether the email matched a real
//     user, same response shape on the route for both cases. This email
//     only fires when there IS a match; the absence of an email is the
//     anti-enumeration signal.
//   - The link's lifetime (60 minutes) is communicated in the body so
//     the user knows to click promptly.
//   - The footer omits an unsubscribe link. Transactional security
//     emails are not promotional, RFC 8058 List-Unsubscribe and CAN-SPAM
//     opt-out requirements don't apply.
//
// API:
//   buildPasswordResetEmail({ to, resetUrl, ipHint? }) -> EmailMessage
// The shape matches what sendEmail() accepts directly.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  // Optional forensic context shown in the body so the user can
  // verify the request was legitimate ("from a device on ip…").
  // When the request arrived via a proxy or the IP is private,
  // pass null/undefined and the line is omitted.
  ipHint?: string | null;
};

export function buildPasswordResetEmail(input: PasswordResetEmailInput): EmailMessage {
  const { to, resetUrl, ipHint } = input;
  const ipLine = ipHint && ipHint.trim()
    ? `\n\nThis request came from ${ipHint.trim()}. If that isn't you, ignore this email and your password stays unchanged.`
    : "\n\nIf you didn't request this, ignore this email and your password stays unchanged.";

  const intro = `Someone asked to reset the password on your Kiddo account. Use the button below to set a new one. The link is good for the next 60 minutes.${ipLine}`;

  const { html } = renderKiddoEmail({
    heading: "Reset your Kiddo password",
    intro,
    cta: { text: "Reset password", url: resetUrl },
    postscript: "If you keep getting these without asking for them, write to support and we'll lock the account down.",
  });

  // Plain-text fallback. Some clients still prefer text; others use it
  // when rendering HTML fails. Keep the wording close to the HTML body
  // but include the bare URL since text can't be a button.
  const text = [
    `Someone asked to reset the password on your Kiddo account.`,
    ``,
    `Use this link to set a new one (good for 60 minutes):`,
    resetUrl,
    ``,
    ipHint && ipHint.trim()
      ? `This request came from ${ipHint.trim()}. If that isn't you, ignore this email and your password stays unchanged.`
      : `If you didn't request this, ignore this email and your password stays unchanged.`,
    ``,
    `If you keep getting these without asking for them, write to support and we'll lock the account down.`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: "Reset your Kiddo password",
    text,
    html,
    tags: ["password-reset"],
    metadata: { kind: "password_reset" },
  };
}
