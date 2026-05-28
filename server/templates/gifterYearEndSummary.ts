// Gifter year-end giving summary email.
//
// Counterpart to the parent-side yearEndWrapped (which goes to fund
// owners). This one goes to GIFTERS, the grandparent, aunt, uncle,
// godparent, or family friend who gave across one or more kids
// during the calendar year. Aggregates ALL of the gifter's gifts
// across every recipient.
//
// Tone matches yearEndWrapped: reflective, numbers-forward, calm.
// Apple-Settings register; no confetti, no "Spotify Wrapped" tropes.
// The numbers do the celebrating.
//
// Surfaces the receipt-grade detail rows via the shared
// renderKiddoEmail({details}) slot (added 2026-05-19 for the gifter
// receipt upgrade). The structured block reads CPA-cleanly for
// Form 709 annual-exclusion reconciliation; the prose above reads
// human.
//
// Locked 2026-05-19 per the Five Towns roadmap P4.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type PerRecipientSummary = {
  childFirstName: string;
  giftCount: number;
  totalGiftedUsd: number;
};

export type GifterYearEndSummaryInput = {
  to: string;
  gifterFirstName?: string | null;
  year: number;
  // Aggregate stats across all funds.
  totalGiftedUsd: number;
  giftCount: number;
  recipientCount: number;
  largestSingleGiftUsd: number;
  // Per-recipient breakdown (sorted by total descending), used for the
  // structured details block in the HTML email and the plain-text
  // monospace list in the text version. Capped at 8 for layout sanity;
  // any overflow surfaces as a "+ N more recipients" summary row.
  perRecipient: PerRecipientSummary[];
  // CSV download URL (signed link or authenticated link to
  // /api/gifter-account/gifts.csv?year=YYYY). Optional, if the
  // platform decides to offer it via the dashboard only, omit here.
  csvDownloadUrl?: string | null;
  dashboardUrl: string;
  unsubscribeUrl?: string | null;
};

function fmtUsd(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const MAX_RECIPIENTS_RENDERED = 8;

export function buildGifterYearEndSummaryEmail(input: GifterYearEndSummaryInput): EmailMessage {
  const {
    to,
    gifterFirstName,
    year,
    totalGiftedUsd,
    giftCount,
    recipientCount,
    largestSingleGiftUsd,
    perRecipient,
    csvDownloadUrl,
    dashboardUrl,
    unsubscribeUrl,
  } = input;

  const greeting = gifterFirstName?.trim() ? `Hi ${gifterFirstName.trim()},` : "Hi there,";

  // Recipient phrasing varies by count, "Emma" / "Emma and Alex" /
  // "Emma, Alex, and Mila" / "the 5 kids you supported", so the line
  // reads naturally instead of mechanical.
  const recipientNames = perRecipient.map((r) => r.childFirstName).filter(Boolean);
  const recipientPhrase = (() => {
    if (recipientNames.length === 0) return "the kids you supported";
    if (recipientNames.length === 1) return recipientNames[0];
    if (recipientNames.length === 2) return `${recipientNames[0]} and ${recipientNames[1]}`;
    if (recipientNames.length === 3) return `${recipientNames[0]}, ${recipientNames[1]}, and ${recipientNames[2]}`;
    return `the ${recipientNames.length} kids you supported`;
  })();

  const intro = [
    greeting,
    ``,
    `Your ${year} in giving.`,
    ``,
    `${giftCount} gift${giftCount === 1 ? "" : "s"} across ${recipientPhrase}. ${fmtUsd(totalGiftedUsd)} total.`,
    largestSingleGiftUsd > 0 && giftCount > 1
      ? `Largest single gift: ${fmtUsd(largestSingleGiftUsd)}.`
      : null,
    ``,
    `Every gift went into a UTMA custodial account at DriveWealth and started compounding the moment it settled.`,
    ``,
    csvDownloadUrl
      ? `For your records: download a full CSV of every gift below, or from your dashboard any time.`
      : `For your records: open your dashboard for the full gift-by-gift history.`,
  ]
    .filter(Boolean)
    .join("\n");

  // Per-recipient details block, structured key/value rows via the
  // renderKiddoEmail details slot. Caps at MAX_RECIPIENTS_RENDERED;
  // overflow rolls into a single "+ N more recipients" summary row.
  const visibleRecipients = perRecipient.slice(0, MAX_RECIPIENTS_RENDERED);
  const hiddenRecipients = perRecipient.slice(MAX_RECIPIENTS_RENDERED);
  const details: Array<{ label: string; value: string }> = [];
  details.push({ label: `${year} total`, value: fmtUsd(totalGiftedUsd) });
  for (const r of visibleRecipients) {
    details.push({
      label: r.childFirstName,
      value: `${r.giftCount} gift${r.giftCount === 1 ? "" : "s"} · ${fmtUsd(r.totalGiftedUsd)}`,
    });
  }
  if (hiddenRecipients.length > 0) {
    const overflowTotal = hiddenRecipients.reduce((s, r) => s + r.totalGiftedUsd, 0);
    const overflowGifts = hiddenRecipients.reduce((s, r) => s + r.giftCount, 0);
    details.push({
      label: `+ ${hiddenRecipients.length} more recipient${hiddenRecipients.length === 1 ? "" : "s"}`,
      value: `${overflowGifts} gift${overflowGifts === 1 ? "" : "s"} · ${fmtUsd(overflowTotal)}`,
    });
  }

  const { html } = renderKiddoEmail({
    heading: `Your ${year} in giving`,
    intro,
    details,
    cta: csvDownloadUrl
      ? { text: "Download CSV for records", url: csvDownloadUrl }
      : { text: "Open your gifter dashboard", url: dashboardUrl },
    postscript: csvDownloadUrl
      ? `Dashboard: ${dashboardUrl}`
      : undefined,
    unsubscribeUrl: unsubscribeUrl ?? undefined,
  });

  // Plain-text version with monospace-aligned recipient list.
  const textRecipientLines = visibleRecipients.map((r) => {
    const label = r.childFirstName.padEnd(20, " ");
    const value = `${r.giftCount} gift${r.giftCount === 1 ? "" : "s"} · ${fmtUsd(r.totalGiftedUsd)}`;
    return `  ${label}${value}`;
  });
  if (hiddenRecipients.length > 0) {
    const overflowTotal = hiddenRecipients.reduce((s, r) => s + r.totalGiftedUsd, 0);
    const overflowGifts = hiddenRecipients.reduce((s, r) => s + r.giftCount, 0);
    textRecipientLines.push(
      `  ${`+ ${hiddenRecipients.length} more`.padEnd(20, " ")}${overflowGifts} gift${overflowGifts === 1 ? "" : "s"} · ${fmtUsd(overflowTotal)}`,
    );
  }

  const text = [
    greeting,
    ``,
    `Your ${year} in giving.`,
    ``,
    `${giftCount} gift${giftCount === 1 ? "" : "s"} across ${recipientPhrase}. ${fmtUsd(totalGiftedUsd)} total.`,
    largestSingleGiftUsd > 0 && giftCount > 1
      ? `Largest single gift: ${fmtUsd(largestSingleGiftUsd)}.`
      : null,
    ``,
    `Per recipient`,
    `----------------------------------------`,
    ...textRecipientLines,
    `----------------------------------------`,
    ``,
    `Every gift went into a UTMA custodial account at DriveWealth and started compounding the moment it settled.`,
    ``,
    csvDownloadUrl ? `Download CSV: ${csvDownloadUrl}` : null,
    `Dashboard: ${dashboardUrl}`,
    ``,
    `Tax note: gifts to UTMAs create no tax liability for you. The recipient's parent receives any 1099 from DriveWealth. If your total gifts to any one recipient this year exceeded the IRS annual gift-tax exclusion ($18,000 for 2024, adjusted yearly), Form 709 may apply. Your CPA can confirm.`,
    ``,
    `Kiddo, Inc. is a technology company, not a broker-dealer.`,
    `Securities offered through DriveWealth, LLC (FINRA/SIPC).`,
    ``,
    `The Kiddo team`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    to,
    subject: `Your ${year} in giving: ${fmtUsd(totalGiftedUsd)} across ${recipientCount} ${recipientCount === 1 ? "kid" : "kids"}`,
    text,
    html,
    tags: ["gifter-year-end-summary"],
    metadata: { kind: "gifter_year_end_summary", year },
    listUnsubscribeUrl: unsubscribeUrl ?? undefined,
  };
}
