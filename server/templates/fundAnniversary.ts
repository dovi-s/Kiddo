// Fund anniversary email. Fires on the yearly anniversary of fund
// creation (NOT the kid's birthday — that's the separate
// fundBirthday worker). Marks the moment the parent started this.
//
// Voice is the FUND, same anthropomorphic convention as the
// birthday template: "Emma's fund just turned 3 years old." Quiet,
// reflective, no upgrade push.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type FundAnniversaryInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  fundAgeYears: number;
  fundTotalUsd: number;
  dashboardUrl: string;
  memoryBookUrl?: string | null;
  unsubscribeUrl?: string | null;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

export function buildFundAnniversaryEmail(input: FundAnniversaryInput): EmailMessage {
  const { to, parentFirstName, childFirstName, fundAgeYears, fundTotalUsd, dashboardUrl, memoryBookUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";
  const yearLabel = ordinal(fundAgeYears);
  const intro = [
    greeting,
    ``,
    `${childFirstName}'s fund turned ${fundAgeYears} years old today. ${yearLabel} year of compounding.`,
    ``,
    `As of this morning the fund is at ${formatUsd(fundTotalUsd)}. Every dollar of that is still ${childFirstName}'s, still working.`,
    ``,
    memoryBookUrl
      ? `If you want to mark the year with a note, the Memory Book is where it goes.`
      : `Quiet years compound the same as loud ones.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `${yearLabel} year for ${childFirstName}'s fund`,
    intro,
    cta: { text: `Open ${childFirstName}'s fund`, url: dashboardUrl },
    postscript: memoryBookUrl ? `Memory Book: ${memoryBookUrl}` : undefined,
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });

  const text = [
    greeting,
    ``,
    `${childFirstName}'s fund turned ${fundAgeYears} years old today. ${yearLabel} year of compounding.`,
    ``,
    `As of this morning the fund is at ${formatUsd(fundTotalUsd)}.`,
    ``,
    `Open the fund: ${dashboardUrl}`,
    memoryBookUrl ? `Add a note: ${memoryBookUrl}` : null,
    ``,
    `The Kiddo team`,
  ].filter(Boolean).join("\n");

  return {
    to,
    subject: `${yearLabel} year for ${childFirstName}'s fund`,
    text,
    html,
    tags: ["fund-anniversary"],
    metadata: { kind: "fund_anniversary", fundAgeYears },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
