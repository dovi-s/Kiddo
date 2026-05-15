// Verification email. Sent on signup; the link the parent clicks
// stamps users.email_verified_at and unlocks the "verified" state.
//
// Uses renderKiddoEmail for the branded HTML wrapper, with a plain-
// text fallback for clients that prefer text or fail to render HTML.
//
// Tone: welcoming but not over-celebratory. The first email from
// Kiddo sets the register for every email that follows — warm,
// minimal, Apple-Settings calm. Avoid "🎉 welcome aboard!" energy.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type VerificationEmailInput = {
  to: string;
  verifyUrl: string;
  // Optional first-name personalization. Falls back to "there" when
  // the parent didn't supply a first name during register.
  firstName?: string | null;
};

export function buildVerificationEmail(input: VerificationEmailInput): EmailMessage {
  const { to, verifyUrl, firstName } = input;
  const greeting = firstName && firstName.trim() ? `Hi ${firstName.trim()},` : "Hi there,";

  const intro = [
    `${greeting}`,
    ``,
    `Thanks for starting a Kiddo fund. One small step before gifts can come in: confirm this email is yours by tapping the button below. The link works for 7 days.`,
    ``,
    `If you didn't sign up for Kiddo, ignore this email. The account stays inactive without verification and gets cleaned up automatically.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: "Confirm your email",
    intro,
    cta: { text: "Confirm email", url: verifyUrl },
  });

  const text = [
    greeting,
    ``,
    `Thanks for starting a Kiddo fund. One small step before gifts can come in: confirm this email is yours by opening this link (good for 7 days):`,
    verifyUrl,
    ``,
    `If you didn't sign up for Kiddo, ignore this email. The account stays inactive without verification and gets cleaned up automatically.`,
    ``,
    `— The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: "Confirm your Kiddo email",
    text,
    html,
    tags: ["email-verification"],
    metadata: { kind: "email_verification" },
  };
}
