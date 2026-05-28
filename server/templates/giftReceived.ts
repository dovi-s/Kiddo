// Per-gift "your gift just landed" email to the parent.
//
// Fires when an ordinary (below the large-gift threshold) gift from
// someone OTHER than the parent completes. This is the loop-closure
// pull: the gift-arrival moment is the single highest-intent reason
// to bring the parent (and through them, the kid) back into the fund
// — to read the note, see it land in the Memory Book, and feel the
// thing the gifter sent. A websocket ping only reaches a parent who
// already has a tab open; this reaches the rest.
//
// Tone: warm, not transactional-cold and not salesy. "Someone who
// loves your kid showed up." Matches the locked Kiddo copy voice and
// the demo's "watch the gift you sent land" framing.
//
// Relationship to largeGiftAlert: that template is a factual
// verification heads-up for gifts at/above the threshold. To avoid
// two emails for one gift, the caller sends THIS one only BELOW that
// threshold. Large gifts keep the verification email; ordinary gifts
// get this warm one.
//
// This is transactional (it's about activity in the parent's own
// account, not promotional), so it sets no List-Unsubscribe — same
// stance as largeGiftAlert and the new-device alert.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type GiftReceivedInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  gifterName?: string | null;
  amountUsd: number;
  hasNote: boolean;
  dashboardUrl: string;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function buildGiftReceivedEmail(input: GiftReceivedInput): EmailMessage {
  const { to, parentFirstName, childFirstName, gifterName, amountUsd, hasNote, dashboardUrl } = input;

  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";

  const who = gifterName && gifterName.trim() ? gifterName.trim() : "Someone who loves them";
  const openLine = `${who} just gave ${childFirstName} ${formatUsd(amountUsd)}.`;
  const noteLine = hasNote
    ? `They left a note, too — it's waiting in ${childFirstName}'s Memory Book.`
    : `It's recorded in ${childFirstName}'s fund.`;

  const intro = [
    greeting,
    ``,
    openLine,
    ``,
    noteLine,
    ``,
    `This is the part that compounds — not just the money, but the people showing up for ${childFirstName} over the years. Take a look.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `${who} gave ${childFirstName} a gift`,
    intro,
    cta: { text: "See it land", url: dashboardUrl },
    postscript: `When investing is live, every gift follows the strategy you set. Until then, it's safely recorded in ${childFirstName}'s fund.`,
  });

  const text = [
    greeting,
    ``,
    openLine,
    ``,
    noteLine,
    ``,
    `See it land: ${dashboardUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: `${who} gave ${childFirstName} a gift`,
    text,
    html,
    tags: ["gift-received-parent"],
    metadata: { kind: "gift_received_parent", amount: amountUsd },
  };
}
