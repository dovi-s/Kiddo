// Large-gift verification email.
//
// Fires when a gift above the configured threshold arrives. Sent to
// the fund's parent (the account holder) as a security heads-up so
// they can flag unexpected large arrivals. Most large gifts are
// legitimate (grandparent inheritance distribution, baby-shower
// pooled gift, etc.), the email is informational, not alarmist.
//
// Tone: matches the new-device-alert template. Factual, not "ALERT."
// Includes the gifter's name + amount + arrival time so the parent
// can either nod ("yes, Grandma told me about that") or flag
// support ("we don't know any 'XYZ'").

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type LargeGiftAlertInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  gifterName?: string | null;
  amountUsd: number;
  arrivedAt: Date;
  dashboardUrl: string;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function buildLargeGiftAlertEmail(input: LargeGiftAlertInput): EmailMessage {
  const { to, parentFirstName, childFirstName, gifterName, amountUsd, arrivedAt, dashboardUrl } = input;
  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";
  const gifterLine = gifterName && gifterName.trim()
    ? `${gifterName.trim()} just sent ${formatUsd(amountUsd)} to ${childFirstName}'s fund.`
    : `A ${formatUsd(amountUsd)} gift just arrived in ${childFirstName}'s fund.`;
  const whenStr = arrivedAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const intro = [
    greeting,
    ``,
    gifterLine,
    ``,
    `When: ${whenStr}`,
    ``,
    `That's above our 'heads up' threshold, so we wanted to surface it so you can keep track. Most large gifts are expected (a grandparent's inheritance distribution, a pooled baby-shower gift, a graduation envelope). If this one wasn't expected, write to support and we'll help you sort it out.`,
    ``,
    `Either way, the gift is recorded in ${childFirstName}'s fund. Once investing is live, it follows the strategy you set.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `${formatUsd(amountUsd)} arrived in ${childFirstName}'s fund`,
    intro,
    cta: { text: "Open Dashboard", url: dashboardUrl },
    postscript: "If this gift looks unexpected, reply to this email and we'll investigate.",
  });

  const text = [
    greeting,
    ``,
    gifterLine,
    ``,
    `When: ${whenStr}`,
    ``,
    `That's above our 'heads up' threshold, so we wanted to surface it so you can keep track. Most large gifts are expected; if this one wasn't, write to support and we'll help you sort it out.`,
    ``,
    `Open Dashboard: ${dashboardUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: `Heads up: ${formatUsd(amountUsd)} arrived in ${childFirstName}'s fund`,
    text,
    html,
    tags: ["large-gift-alert"],
    metadata: { kind: "large_gift_alert", amount: amountUsd },
  };
}
