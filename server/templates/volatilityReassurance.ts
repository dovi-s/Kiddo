// Volatility reassurance email (Tier 2 #11, Vanguard playbook).
// Fires when the fund's invested balance drops X% in a single
// day. Tone is calm-and-context, not panicky. Vanguard's playbook:
// remind the long-horizon investor that drops are part of the
// math, not a signal to act.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type VolatilityReassuranceInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  yearsToMajority: number;
  dropPct: number;
  currentBalanceUsd: number;
  dashboardUrl: string;
  unsubscribeUrl?: string | null;
};

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function buildVolatilityReassuranceEmail(input: VolatilityReassuranceInput): EmailMessage {
  const { to, parentFirstName, childFirstName, yearsToMajority, dropPct, currentBalanceUsd, dashboardUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";
  const dropDisplay = Math.abs(dropPct).toFixed(1);
  const horizonLine = yearsToMajority > 5
    ? `${childFirstName} has ${yearsToMajority} years until the fund transfers. That's a lot of time for the math to do its work.`
    : `${childFirstName} has ${yearsToMajority} year${yearsToMajority === 1 ? "" : "s"} until the fund transfers.`;
  const intro = [
    greeting,
    ``,
    `The market had a rough day. ${childFirstName}'s fund is down about ${dropDisplay}% from yesterday, now at ${fmtUsd(currentBalanceUsd)}.`,
    ``,
    `Days like this happen. The S&P 500 has had drops larger than 2% on roughly 1 in every 30 trading days historically. They look loud in the moment and quiet in a 10-year chart.`,
    ``,
    horizonLine,
    ``,
    `Nothing's been sold. The shares you own are the same shares. The price the market quoted them at today was lower; the math of long-horizon compounding still works.`,
    ``,
    `If you want to think about strategy, this is a calm time to do it. If you don't, doing nothing is usually the right move at moments like this.`,
  ].join("\n");
  const { html } = renderKiddoEmail({
    heading: `${childFirstName}'s fund had a rough day`,
    intro,
    cta: { text: "Open Dashboard", url: dashboardUrl },
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });
  const text = [
    greeting,
    ``,
    `The market had a rough day. ${childFirstName}'s fund is down about ${dropDisplay}% from yesterday, now at ${fmtUsd(currentBalanceUsd)}.`,
    ``,
    `Days like this happen. They look loud in the moment and quiet in a 10-year chart.`,
    ``,
    horizonLine,
    ``,
    `Nothing's been sold. The shares you own are the same shares. The math of long-horizon compounding still works.`,
    ``,
    `Open the Dashboard: ${dashboardUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");
  return {
    to,
    subject: `${childFirstName}'s fund had a rough day`,
    text,
    html,
    tags: ["volatility-reassurance"],
    metadata: { kind: "volatility_reassurance", dropPct },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
