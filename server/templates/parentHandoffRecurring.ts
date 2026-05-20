// Parent-side handoff email: recurring investment paused, with an
// honest offer to keep contributing as a recurring gift.
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
// relationship ends but the gifter relationship continues — this
// email is the bridge. Same amount, same cadence, this time
// flowing through the gift loop instead of the custodial mechanic.
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
    `If you want to keep showing up, you can set up the same contribution as a recurring gift. Same amount, same cadence, this time through the gift link. ${childFirstName} sees who it's from. It still lands in the same fund.`,
    ``,
    `Or do nothing. The pause stays. No further charges, no follow-ups about it.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `${childFirstName} is the owner now`,
    intro,
    cta: { text: `Set up a recurring gift`, url: giftLinkUrl },
    postscript: `If you do nothing, the recurring contribution stays paused. We won't email you about this again.`,
  });

  const text = [
    greeting,
    ``,
    `${childFirstName}'s fund is legally ${childFirstName}'s now. Under state UTMA law, the custodian role ends at majority and the kid takes full ownership.`,
    ``,
    `Your ${cadence} ${amount} contribution stopped automatically because the account is no longer custodial. We did this so you wouldn't be charged for a fund you no longer manage.`,
    ``,
    `If you want to keep showing up, you can set up the same contribution as a recurring gift. Same amount, same cadence, this time through the gift link. ${childFirstName} sees who it's from. It still lands in the same fund.`,
    ``,
    `Set up a recurring gift: ${giftLinkUrl}`,
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
