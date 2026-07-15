// Kid-age milestone email. Fires at 5 / 10 / 13 / 16, the
// childhood inflection ages most worth marking. Distinct from
// the every-year fundBirthday worker: this is the parent-side
// reflective email ("Emma is 10. The fund has been quietly
// building for 7 of those years"), while fundBirthday is the
// every-year voice-of-the-fund.
//
// Tone: reflective, parent-facing, no upgrade push. Just the
// number + the fund's grounded total. Per the locked email
// strategy notes: "quiet, once a year, no upgrade push."

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

const MILESTONE_FRAMES: Record<number, { heading: (name: string) => string; reflection: (name: string, fundYears: number) => string }> = {
  5: {
    heading: (name) => `${name} just turned 5`,
    reflection: (name, years) =>
      `${name} starts kindergarten this year. The fund has been growing for ${years} of those.`,
  },
  10: {
    heading: (name) => `${name} is 10`,
    reflection: (name, years) =>
      `Halfway to 18. ${years} years in, and the next 8 are the ones that add up.`,
  },
  13: {
    heading: (name) => `${name} is 13`,
    reflection: (name, years) =>
      `Five years until the fund transfers. If you have a money conversation in mind, this is the year to start.`,
  },
  16: {
    heading: (name) => `${name} is 16`,
    reflection: (name, years) =>
      `Two years to go. This is the age most parents start showing their kid what's been waiting.`,
  },
};

export type KidMilestoneInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  age: 5 | 10 | 13 | 16;
  fundAgeYears: number;
  fundTotalUsd: number;
  dashboardUrl: string;
  unsubscribeUrl?: string | null;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function buildKidMilestoneEmail(input: KidMilestoneInput): EmailMessage {
  const { to, parentFirstName, childFirstName, age, fundAgeYears, fundTotalUsd, dashboardUrl, unsubscribeUrl } = input;
  const frame = MILESTONE_FRAMES[age];
  if (!frame) throw new Error(`KidMilestoneEmail: unsupported age ${age}`);
  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";

  const intro = [
    greeting,
    ``,
    frame.reflection(childFirstName, Math.max(1, fundAgeYears)),
    ``,
    `As of this morning the fund is at ${formatUsd(fundTotalUsd)}. Every dollar of it is still ${childFirstName}'s.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: frame.heading(childFirstName),
    intro,
    cta: { text: `Open ${childFirstName}'s fund`, url: dashboardUrl },
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });

  const text = [
    greeting,
    ``,
    frame.reflection(childFirstName, Math.max(1, fundAgeYears)),
    ``,
    `As of this morning the fund is at ${formatUsd(fundTotalUsd)}.`,
    ``,
    `Open ${childFirstName}'s fund: ${dashboardUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: frame.heading(childFirstName),
    text,
    html,
    tags: ["kid-milestone", `age-${age}`],
    metadata: { kind: "kid_milestone", age, fundAgeYears },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
