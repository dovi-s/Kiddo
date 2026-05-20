// Gifter return-year reminder. Sent to a gifter who hasn't gifted
// in 12+ months (their last gift was over a year ago). Soft prompt
// ('the kid is older now; the fund is bigger') — no shame, no
// urgency.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type GifterReturnReminderInput = {
  to: string;
  gifterFirstName?: string | null;
  childFirstName: string;
  lastGiftMonthsAgo: number;
  giftUrl: string;
  unsubscribeUrl?: string | null;
};

export function buildGifterReturnReminderEmail(input: GifterReturnReminderInput): EmailMessage {
  const { to, gifterFirstName, childFirstName, lastGiftMonthsAgo, giftUrl, unsubscribeUrl } = input;
  const greeting = gifterFirstName?.trim() ? `Hi ${gifterFirstName.trim()},` : "Hi there,";
  const timeAgoLine = lastGiftMonthsAgo >= 24
    ? `It's been over two years since your last gift to ${childFirstName}.`
    : `It's been about a year since your last gift to ${childFirstName}.`;
  const intro = [
    greeting,
    ``,
    timeAgoLine,
    ``,
    `${childFirstName} is a year older. The fund kept compounding what you put in. If you'd like to add to it again, the same link still works.`,
    ``,
    `Not the right time? Ignore this email; we won't send another reminder until next year.`,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: `${childFirstName} is still here`,
    intro,
    cta: { text: `Gift to ${childFirstName}`, url: giftUrl },
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });
  const text = [
    greeting,
    ``,
    timeAgoLine,
    ``,
    `${childFirstName} is a year older. The same gift link still works:`,
    giftUrl,
    ``,
    `Not the right time? Ignore this email.`,
    ``,
    `The Kiddo team`,
  ].join("\n");
  return {
    to,
    subject: `${childFirstName} is still here`,
    text,
    html,
    tags: ["gifter-return-reminder"],
    metadata: { kind: "gifter_return_reminder", lastGiftMonthsAgo },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
