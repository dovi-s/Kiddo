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
  // null = no 30-day baseline available (young fund / no snapshot): the
  // change line is OMITTED — we never claim "+$0" out of ignorance.
  changeUsd: number | null;
  changePct: number | null;
  giftCount30d: number;
  newGifterCount30d: number;
  // The PEOPLE who gave in the last 30 days (deduped, "Anonymous" excluded),
  // most-recent first. This is the relationship soul Acorns structurally can't
  // send: a brokerage statement says "3 deposits", we say "Grandma and Uncle Mike
  // gave". When present, we lead with the names instead of a bare count.
  gifterNames?: string[];
  // One recent gift note to surface as the month's Memory Book moment (the
  // artifact). The parent already owns/sees this in the Memory Book; the digest
  // just brings it back to them. Null when there's no note to show.
  memoryMoment?: { senderName: string; message: string } | null;
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
function humanizeNames(names: string[]): string {
  const n = names.map((s) => s.trim()).filter(Boolean);
  if (n.length === 0) return "";
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  if (n.length === 3) return `${n[0]}, ${n[1]}, and ${n[2]}`;
  return `${n[0]}, ${n[1]}, and ${n.length - 2} others`;
}
function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function buildMonthlyPulseEmail(input: MonthlyPulseInput): EmailMessage {
  const { to, parentFirstName, childFirstName, fundTotalUsd, changeUsd, changePct, giftCount30d, newGifterCount30d, gifterNames, memoryMoment, monthName, dashboardUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";
  const names = humanizeNames(gifterNames ?? []);
  const giftLine = giftCount30d === 0
    ? `No gifts last month. The fund quietly compounded what was already there.`
    : names
      ? `${names} gave last month.`
      : `${giftCount30d} gift${giftCount30d === 1 ? "" : "s"} arrived last month${newGifterCount30d > 0 ? `, ${newGifterCount30d} from new gifter${newGifterCount30d === 1 ? "" : "s"}` : ""}.`;
  const memoryLine = memoryMoment && memoryMoment.message.trim()
    ? `${memoryMoment.senderName.trim() || "A gifter"} left a note: “${truncate(memoryMoment.message, 140)}”`
    : null;
  const changeLine = changeUsd == null
    ? null
    : changePct != null
      ? `That's ${fmtSignedUsd(changeUsd)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%) from this time last month.`
      : `That's ${fmtSignedUsd(changeUsd)} from this time last month.`;
  const intro = [
    greeting,
    ``,
    `${childFirstName}'s fund is at ${fmtUsd(fundTotalUsd)}.`,
    ...(changeLine ? [``, changeLine] : []),
    ``,
    giftLine,
    ...(memoryLine ? [``, memoryLine] : []),
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
    ...(changeLine ? [``, changeLine] : []),
    ``,
    giftLine,
    ...(memoryLine ? [``, memoryLine] : []),
    ``,
    `Open the fund: ${dashboardUrl}`,
    ``,
    `The Kiddo team`,
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
