// Gifter magic-link auth email. Two intents share this template:
//
//   - 'gifter_welcome': fired by webhookHandlers.ts immediately after
//     the gifter-recurring Stripe checkout.session.completed event.
//     The gifter just gave a recurring gift WITHOUT setting a password
//     (per project_recurring_gifting_without_password_spec.md). The
//     email greets them, confirms the gift, and offers the link to
//     manage their schedule.
//
//   - 'gifter_relogin': fired by /api/auth/magic-link/request when an
//     existing magic-link gifter wants to sign in weeks later from
//     Login.tsx. Same template, different intro.
//
// Security notes:
//   - Raw token in the URL; DB stores SHA-256(token). Single-use,
//     15-minute TTL.
//   - We don't include the gifter's first name in the welcome intent
//     (we may not have it yet — gifter-recurring just captured email).
//     We do include it in the relogin intent when available.
//   - Anti-enumeration discipline: this email only fires when there IS
//     a matching account or a fresh post-checkout welcome. The request
//     route returns 200 regardless of email match.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type GifterMagicLinkInput = {
  to: string;
  linkUrl: string;
  intent: "gifter_welcome" | "gifter_relogin";
  firstName?: string | null;
  // For welcome intent: optional summary so the email confirms the
  // gift the gifter just set up. Either omitted (we'll generic-copy)
  // or { amount, ticker, fundName } if the webhook has them.
  giftSummary?: {
    amount: number;
    ticker: string;
    fundName: string;
  } | null;
};

export function buildGifterMagicLinkEmail(input: GifterMagicLinkInput): EmailMessage {
  const { to, linkUrl, intent, firstName, giftSummary } = input;

  const greeting = firstName && firstName.trim() ? `Hi ${firstName.trim()},` : "Hi there,";

  let intro: string;
  let heading: string;
  let subject: string;
  let cta: string;
  let postscript: string;

  if (intent === "gifter_welcome") {
    heading = "Welcome to Kiddo";
    subject = "Your recurring gift is set up. Tap to manage it.";
    cta = "Open my gifter dashboard";
    const giftLine = giftSummary
      ? `Your recurring gift of $${giftSummary.amount.toFixed(2)} in ${giftSummary.ticker} to ${giftSummary.fundName} is set up and will run on the schedule you chose.`
      : `Your recurring gift is set up and will run on the schedule you chose.`;
    intro = `${greeting} ${giftLine} Tap the button below to open your dashboard. You'll see every gift you've sent, manage the schedule, or pause it any time. The link is good for the next 15 minutes; we'll email you a fresh one whenever you need to sign in.`;
    postscript = "We don't ask for passwords. Every time you want to manage your gifts, click the link in any Kiddo email or request a new one from the sign-in page. We'll never ask you to forward or share a sign-in link, even if someone says they're from Kiddo.";
  } else {
    heading = "Your sign-in link";
    subject = "Your Kiddo sign-in link";
    cta = "Sign in to Kiddo";
    intro = `${greeting} Tap the button below to sign in to your gifter dashboard. The link is good for the next 15 minutes. If you didn't request this, ignore this email. Your account stays safe.`;
    postscript = "We don't ask for passwords on gifter accounts. Every sign-in goes through a fresh link like this one. Keep it to yourself; we'll never ask you to forward or share a sign-in link, even if someone says they're from Kiddo.";
  }

  const { html } = renderKiddoEmail({
    heading,
    intro,
    cta: { text: cta, url: linkUrl },
    postscript,
  });

  const text = [
    intent === "gifter_welcome"
      ? `Welcome to Kiddo.`
      : `Your Kiddo sign-in link.`,
    ``,
    intro,
    ``,
    `Open the link below (good for 15 minutes):`,
    linkUrl,
    ``,
    postscript,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject,
    text,
    html,
    tags: [intent === "gifter_welcome" ? "gifter-magic-welcome" : "gifter-magic-relogin"],
    metadata: { kind: intent },
  };
}
