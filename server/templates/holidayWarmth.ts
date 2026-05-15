// Holiday warmth email. Reusable template for Mother's Day +
// Father's Day. Tone is gratitude-forward, no upgrade push,
// no celebratory clutter. Acknowledges the role without
// prescribing what the parent should feel about it.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type HolidayWarmthInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  fundTotalUsd: number;
  holidayLabel: "Mother's Day" | "Father's Day";
  parentRole: "mom" | "dad" | "parent";
  dashboardUrl: string;
  memoryBookUrl?: string | null;
  unsubscribeUrl?: string | null;
};

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function buildHolidayWarmthEmail(input: HolidayWarmthInput): EmailMessage {
  const { to, parentFirstName, childFirstName, fundTotalUsd, holidayLabel, parentRole, dashboardUrl, memoryBookUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";
  const role = parentRole === "mom" ? "mom" : parentRole === "dad" ? "dad" : "parent";
  const intro = [
    greeting,
    ``,
    `Happy ${holidayLabel}.`,
    ``,
    `${childFirstName}'s fund is at ${fmtUsd(fundTotalUsd)} today. You started it. You keep showing up. That's the whole thing.`,
    ``,
    memoryBookUrl
      ? `If today's the day you want to leave ${childFirstName} a note for them to read at 18, the Memory Book is where it goes.`
      : `The kind of ${role} that builds a fund quietly for years is the kind of ${role} ${childFirstName} reads about later.`,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: `Happy ${holidayLabel}`,
    intro,
    cta: memoryBookUrl
      ? { text: "Open Memory Book", url: memoryBookUrl }
      : { text: `Open ${childFirstName}'s fund`, url: dashboardUrl },
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });
  const text = [
    greeting,
    ``,
    `Happy ${holidayLabel}.`,
    ``,
    `${childFirstName}'s fund is at ${fmtUsd(fundTotalUsd)} today. You started it. You keep showing up. That's the whole thing.`,
    ``,
    memoryBookUrl ? `Memory Book: ${memoryBookUrl}` : `Open the fund: ${dashboardUrl}`,
    ``,
    `— The Kiddo team`,
  ].join("\n");
  return {
    to,
    subject: `Happy ${holidayLabel}`,
    text,
    html,
    tags: ["holiday-warmth", holidayLabel.toLowerCase().replace(/[^a-z]+/g, "-")],
    metadata: { kind: "holiday_warmth", holidayLabel },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
