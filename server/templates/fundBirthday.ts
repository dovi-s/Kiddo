// Birthday-from-the-fund email. Fires once a year on the kid's
// birthday, addressed to the parent, written in the voice of the
// FUND itself ("Emma's fund just turned three years old today").
//
// This is the unique-voice differentiator. Other apps email
// 'birthday reminder' or 'happy birthday from your bank.' Kiddo's
// twist: the FUND is the narrator. It's not the kid's birthday
// being celebrated — it's the fund's relationship with the kid
// being marked. Warm, slightly anthropomorphic, but never twee.
//
// Tone rules (locked):
//   - No em-dashes.
//   - No 'contribute' word (use 'gift' / 'add to').
//   - No AI-slop sparkles in the subject or body.
//   - The fund 'speaks' in first person but stays grounded. It
//     can say 'I've been growing for Emma for 3 years' but never
//     'I am so proud of how I've grown.' (Crosses into cute.)
//   - Always includes the actual fund value as of send time so the
//     parent has a moment of 'oh wow' grounded in real data, not
//     vibes.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type FundBirthdayInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  childAge: number;
  // Total invested + cash balance at send time. Rendered as
  // 'Emma's fund is now at $X' so the parent gets a fresh
  // grounded number.
  fundTotalUsd: number;
  // Years the fund has existed. Drives 'just turned X years old'.
  fundAgeYears: number;
  // Link back to the fund (Dashboard or Memory Book — the
  // caller decides which is more contextual). Used as the
  // primary CTA in the branded HTML.
  dashboardUrl: string;
  // Optional Memory Book deep link for parents who want to leave
  // a birthday note. When set, surfaced as postscript copy.
  memoryBookUrl?: string | null;
  unsubscribeUrl?: string | null;
};

function formatFundUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function buildFundBirthdayEmail(input: FundBirthdayInput): EmailMessage {
  const {
    to,
    parentFirstName,
    childFirstName,
    childAge,
    fundTotalUsd,
    fundAgeYears,
    dashboardUrl,
    memoryBookUrl,
    unsubscribeUrl,
  } = input;
  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";

  // The fund's voice. Singular pronoun, grounded reflection.
  const fundLine = fundAgeYears <= 1
    ? `${childFirstName}'s fund just finished its first year.`
    : `${childFirstName}'s fund just finished year ${fundAgeYears}.`;

  const ageLine = `Today ${childFirstName} turns ${childAge}.`;

  const valueLine = `As of this morning the fund is at ${formatFundUsd(fundTotalUsd)}. Every dollar of it is still ${childFirstName}'s, still working.`;

  const intro = [
    greeting,
    ``,
    fundLine,
    ``,
    ageLine,
    ``,
    valueLine,
    ``,
    memoryBookUrl
      ? `If you want to add a note from today, the Memory Book is where it goes. Future ${childFirstName} reads it on their 18th.`
      : `What you started here is the kind of thing ${childFirstName} reads about later. It compounds quietly.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `${childFirstName} turns ${childAge} today`,
    intro,
    cta: { text: `Open ${childFirstName}'s fund`, url: dashboardUrl },
    postscript: memoryBookUrl
      ? `Memory Book: ${memoryBookUrl}`
      : undefined,
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });

  const text = [
    greeting,
    ``,
    fundLine,
    ``,
    ageLine,
    ``,
    valueLine,
    ``,
    `Open ${childFirstName}'s fund: ${dashboardUrl}`,
    memoryBookUrl ? `Add a note in the Memory Book: ${memoryBookUrl}` : null,
    ``,
    `The Kiddo team`,
  ].filter(Boolean).join("\n");

  return {
    to,
    subject: `${childFirstName} turns ${childAge} today`,
    text,
    html,
    tags: ["fund-birthday"],
    metadata: { kind: "fund_birthday", childAge, fundAgeYears },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
