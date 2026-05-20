// Parent-side handoff email: recurring investment paused at majority,
// with an honest invitation to keep contributing as a gifter via the
// public gift link.
//
// Fires from server/recurringContributionWorker.ts when the auto-pause
// sweep detects a parent_contribution whose fund has flipped ownership
// at majority (funds.user_id no longer matches parent_contributions.
// user_id). One email per paused contribution.
//
// Why this email exists: when the kid takes legal ownership of the
// UTMA fund at majority, the parent's recurring contribution stops
// automatically (the worker auto-pauses the row). Without an explicit
// follow-up the parent only sees the event via a passive activity row
// on next dashboard visit. The locked discipline says the custodial
// relationship ends but the gifter relationship continues; this
// email is the bridge.
//
// COPY-VS-UI ALIGNMENT NOTE (locked 2026-05-20):
//
// Earlier copy promised "set up the same contribution as a recurring
// gift. Same amount, same cadence, this time through the gift link."
// That promise required gifter-side recurring to exist in the gift
// link UI. It does not. GiftCheckout.tsx currently supports only
// one-time gifts. The recurring_gifts schema and processGifterRecurring
// worker exist in the codebase but the public-facing UI to create a
// gifter recurring schedule has not been built (or was removed in
// an earlier simplification pass).
//
// The honest move: match the email's CTA to what the UI can actually
// deliver today. "Send another gift any time you want to show up"
// describes what the gift link does and creates no broken promise.
// When gifter recurring is restored in the UI per
// project_gifter_recurring_restoration.md, this copy can return to
// the original "same amount, same cadence" framing.
//
// Tone rules (locked, applied here):
//   - No em-dashes anywhere (per feedback_no_emdash.md)
//   - No marketing-teaser quotes (per feedback_no_marketing_teaser_quotes.md)
//   - No "That's the whole thing"-style AI-slop closers
//   - Calm Apple-Settings register, factual, warm
//   - Acknowledge the moment without sentimentality
//   - Offer the choice without pressure (both paths are fine,
//     including doing nothing)

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type ParentHandoffRecurringInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  amountUsd: number;
  frequency: string; // "monthly" | "weekly" | "quarterly" | "annually"
  giftLinkUrl: string; // public /{slug} URL for the now-kid-owned fund
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function cadenceWord(frequency: string): string {
  const f = (frequency || "monthly").toLowerCase();
  if (f === "weekly") return "weekly";
  if (f === "quarterly") return "quarterly";
  if (f === "annually" || f === "yearly") return "yearly";
  return "monthly";
}

export function buildParentHandoffRecurringEmail(
  input: ParentHandoffRecurringInput,
): EmailMessage {
  const { to, parentFirstName, childFirstName, amountUsd, frequency, giftLinkUrl } = input;

  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";

  const cadence = cadenceWord(frequency);
  const amount = formatUsd(amountUsd);

  const intro = [
    greeting,
    ``,
    `${childFirstName}'s fund is legally ${childFirstName}'s now. Under state UTMA law, the custodian role ends at majority and the kid takes full ownership.`,
    ``,
    `Your ${cadence} ${amount} contribution stopped automatically because the account is no longer custodial. We did this so you wouldn't be charged for a fund you no longer manage.`,
    ``,
    `If you want to keep showing up, you can send a gift any time through ${childFirstName}'s gift link. ${childFirstName} sees who it's from. It still lands in the same fund.`,
    ``,
    `Or do nothing. The pause stays. No further charges, no follow-ups about it.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `${childFirstName} is the owner now`,
    intro,
    cta: { text: `Open ${childFirstName}'s gift link`, url: giftLinkUrl },
    postscript: `If you do nothing, the recurring contribution stays paused. We won't email you about this again.`,
  });

  const text = [
    greeting,
    ``,
    `${childFirstName}'s fund is legally ${childFirstName}'s now. Under state UTMA law, the custodian role ends at majority and the kid takes full ownership.`,
    ``,
    `Your ${cadence} ${amount} contribution stopped automatically because the account is no longer custodial. We did this so you wouldn't be charged for a fund you no longer manage.`,
    ``,
    `If you want to keep showing up, you can send a gift any time through ${childFirstName}'s gift link. ${childFirstName} sees who it's from. It still lands in the same fund.`,
    ``,
    `Open ${childFirstName}'s gift link: ${giftLinkUrl}`,
    ``,
    `Or do nothing. The pause stays. No further charges, no follow-ups about it.`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: `${childFirstName} is the owner now. Your recurring investment paused.`,
    text,
    html,
    tags: ["parent-handoff-recurring-paused"],
    metadata: { kind: "parent_handoff_recurring_paused", amount: amountUsd, frequency: cadence },
  };
}
