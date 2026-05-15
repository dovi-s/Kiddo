// Monthly fund pulse email (Tier 1 #10, the Redfin pattern).
// Habit-forming, not gamified. One short summary per month per
// fund: where the fund is now, how much it changed over the
// last 30 days, who gave, what hit. Calm + factual.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type MonthlyPulseInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  fundTotalUsd: number;
  changeUsd: number;
  changePct: number | null;
  giftCount30d: number;
  newGifterCount30d: number;
  monthName: string;
  dashboardUrl: string;
  unsubscribeUrl?: string | null;
};

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtSignedUsd(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtUsd(Math.abs(n))}`;
}

export function buildMonthlyPulseEmail(input: MonthlyPulseInput): EmailMessage {
  const { to, parentFirstName, childFirstName, fundTotalUsd, changeUsd, changePct, giftCount30d, newGifterCount30d, monthName, dashboardUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";
  const giftLine = giftCount30d === 0
    ? `No gifts last month. The fund quietly compounded what was already there.`
    : `${giftCount30d} gift${giftCount30d === 1 ? "" : "s"} arrived last month${newGifterCount30d > 0 ? `, ${newGifterCount30d} from new gifter${newGifterCount30d === 1 ? "" : "s"}` : ""}.`;
  const changeLine = changePct != null
    ? `That's ${fmtSignedUsd(changeUsd)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%) from this time last month.`
    : `That's ${fmtSignedUsd(changeUsd)} from this time last month.`;
  const intro = [
    greeting,
    ``,
    `${childFirstName}'s fund is at ${fmtUsd(fundTotalUsd)}.`,
    ``,
    changeLine,
    ``,
    giftLine,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: `${monthName} pulse for ${childFirstName}'s fund`,
    intro,
    cta: { text: `Open ${childFirstName}'s fund`, url: dashboardUrl },
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });
  const text = [
    greeting,
    ``,
    `${childFirstName}'s fund is at ${fmtUsd(fundTotalUsd)}.`,
    ``,
    changeLine,
    ``,
    giftLine,
    ``,
    `Open the fund: ${dashboardUrl}`,
    ``,
    `— The Kiddo team`,
  ].join("\n");
  return {
    to,
    subject: `${monthName} pulse for ${childFirstName}'s fund`,
    text,
    html,
    tags: ["monthly-pulse"],
    metadata: { kind: "monthly_pulse" },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
