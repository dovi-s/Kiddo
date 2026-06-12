// Subscription cancellation confirmation (the anti-dark-pattern "you turned off
// renewal" email — the Prime Video / Netflix shape, done the Kiddo way).
//
// This is the trust moment the pricing page promises ("cancel any time, your fund
// stays, the kid's money never leaves"). It is TRANSACTIONAL (a confirmation of an
// action the user took), so it carries NO unsubscribe link and NO win-back guilt.
// State plainly: what ends, exactly when, what stays, and how to turn it back on.
//
// NOT WIRED to a trigger yet. The correct trigger is the Stripe
// customer.subscription.updated event where cancel_at_period_end newly flips true,
// GUARDED against the seamless Family->Plus downgrade (planDowngradeFlag) so a
// downgrade never sends a false "you canceled" note. See webhookHandlers
// handleSubscriptionUpdated. Inert until the email provider is configured.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type SubscriptionCanceledInput = {
  to: string;
  parentFirstName?: string | null;
  // "Kiddo+" or "Kiddo Family" (the plan being turned off).
  planLabel: string;
  // Already-formatted access-end date, e.g. "June 26, 2026".
  accessEndsDate: string;
  // Link to the billing screen (to turn renewal back on).
  manageUrl: string;
};

export function buildSubscriptionCanceledEmail(input: SubscriptionCanceledInput): EmailMessage {
  const { to, parentFirstName, planLabel, accessEndsDate, manageUrl } = input;
  const greeting = parentFirstName?.trim() ? `Hi ${parentFirstName.trim()},` : "Hi there,";

  const lines = [
    greeting,
    ``,
    `You turned off renewal for ${planLabel}. It stays active until ${accessEndsDate}, then your account switches to Free. We didn't charge you anything to make this change.`,
    ``,
    `Your fund and everything in it stay exactly where they are. Your child's money never leaves the fund, you keep seeing every gift, photo, and voice memo in the Memory Book, and your annual tax summary stays free.`,
    ``,
    `When ${planLabel} ends, the Plus tools pause: recurring contributions, custom fund mix, strategy switching, adding your own photos and voice to Memory Book entries, and co-parent access. Recurring gifts a family member set up on their own card keep running, since that's their commitment.`,
    ``,
    `You can turn renewal back on any time before ${accessEndsDate} to keep everything, or resubscribe later. Nothing is lost either way.`,
  ];
  const intro = lines.join("\n");

  const { html } = renderKiddoEmail({
    heading: `Your ${planLabel} is set to end on ${accessEndsDate}`,
    intro,
    cta: { text: "Manage your plan", url: manageUrl },
  });

  const text = [
    ...lines,
    ``,
    `Manage your plan: ${manageUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: `Your ${planLabel} is set to end on ${accessEndsDate}`,
    text,
    html,
    tags: ["subscription-canceled"],
    metadata: { kind: "subscription_canceled" },
    // Transactional confirmation: no listUnsubscribeUrl (not promotional).
  };
}
