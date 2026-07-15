// Year-end Wrapped email (Tier 1 #8). Fires once between Dec 15-31
// per fund. The original email-strategy notes flagged this as
// 'your single biggest organic-share opportunity', give the
// parent something they'll screenshot and post.
//
// Tone: reflective, numbers-forward, calm. NOT 'Spotify Wrapped'
// with confetti. The Kiddo register stays Apple-Settings even on
// the celebratory beat. Numbers do the celebrating.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type YearEndWrappedInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  year: number;
  startBalanceUsd: number;
  endBalanceUsd: number;
  totalGiftedUsd: number;
  giftCount: number;
  uniqueGifterCount: number;
  topGifterName?: string | null;
  topGifterAmountUsd?: number | null;
  largestSingleGiftUsd: number;
  dashboardUrl: string;
  memoryBookUrl?: string | null;
  unsubscribeUrl?: string | null;
};

function fmtUsd(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function buildYearEndWrappedEmail(input: YearEndWrappedInput): EmailMessage {
  const { to, parentFirstName, childFirstName, year, startBalanceUsd, endBalanceUsd, totalGiftedUsd, giftCount, uniqueGifterCount, topGifterName, topGifterAmountUsd, largestSingleGiftUsd, dashboardUrl, memoryBookUrl, unsubscribeUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";
  // Net change = deposits while investing is dark (no returns yet), so it's shown
  // as a dollar delta, NOT a "% return for the year" (that would frame gifts as growth).
  const growthUsd = endBalanceUsd - startBalanceUsd;
  const topGifterLine = topGifterName && topGifterAmountUsd
    ? `Top gifter: ${topGifterName.trim()} (${fmtUsd(topGifterAmountUsd)} across the year).`
    : null;
  const intro = [
    greeting,
    ``,
    `${childFirstName}'s ${year}.`,
    ``,
    `Started the year at ${fmtUsd(startBalanceUsd)}. Ended at ${fmtUsd(endBalanceUsd)}.`,
    `Net change this year: ${growthUsd >= 0 ? "+" : "−"}${fmtUsd(Math.abs(growthUsd))}.`,
    ``,
    `${giftCount} gift${giftCount === 1 ? "" : "s"} arrived from ${uniqueGifterCount} ${uniqueGifterCount === 1 ? "person" : "people"}.`,
    `Total gifted this year: ${fmtUsd(totalGiftedUsd)}.`,
    largestSingleGiftUsd > 0 ? `Largest single gift: ${fmtUsd(largestSingleGiftUsd)}.` : null,
    topGifterLine,
    ``,
    memoryBookUrl
      ? `If you want to mark the year with a note, the Memory Book is where it lands.`
      : `One quiet year, banked.`,
  ].filter(Boolean).join("\n");
  const { html } = renderKiddoEmail({
    heading: `${childFirstName}'s ${year}`,
    intro,
    cta: { text: `Open ${childFirstName}'s fund`, url: dashboardUrl },
    postscript: memoryBookUrl ? `Memory Book: ${memoryBookUrl}` : undefined,
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });
  const text = [
    greeting,
    ``,
    `${childFirstName}'s ${year}.`,
    ``,
    `Started at ${fmtUsd(startBalanceUsd)}. Ended at ${fmtUsd(endBalanceUsd)}.`,
    `Net: ${growthUsd >= 0 ? "+" : "−"}${fmtUsd(Math.abs(growthUsd))}.`,
    ``,
    `${giftCount} gift${giftCount === 1 ? "" : "s"} from ${uniqueGifterCount} people. ${fmtUsd(totalGiftedUsd)} total.`,
    largestSingleGiftUsd > 0 ? `Largest single gift: ${fmtUsd(largestSingleGiftUsd)}.` : null,
    topGifterLine,
    ``,
    `Open the fund: ${dashboardUrl}`,
    memoryBookUrl ? `Add a note: ${memoryBookUrl}` : null,
    ``,
    `The Kiddo team`,
  ].filter(Boolean).join("\n");
  return {
    to,
    subject: `${childFirstName}'s ${year} wrapped`,
    text,
    html,
    tags: ["year-end-wrapped"],
    metadata: { kind: "year_end_wrapped", year },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
