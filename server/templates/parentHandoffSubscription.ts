// Parent-side handoff email: honest "your subscription does not gate
// anything for you anymore" notice with one-click cancel.
//
// Fires when ownership of the parent's LAST managed fund flips to the
// kid at majority AND the parent has an active paid subscription
// (Kiddo+ or Kiddo Family). Single fire, never resent (we don't
// want to nag).
//
// Why this email exists: the locked subscription-retires-at-majority
// principle (project_subscription_retires_at_majority.md) says subs
// are for the parent-as-custodian relationship. Once the kid takes
// over and the parent has no other funds to manage, the sub gates
// nothing. The Cash-App-style move is to keep charging silently;
// Kiddo's locked discipline is to send an honest email offering the
// cancel and let the user choose.
//
// "Or keep it active for future funds" is included because some
// parents WILL want to open another fund (second kid years later,
// or a fund for their own dollars), and forcing them to re-subscribe
// later would be a worse experience than leaving the sub active.
// The choice is the user's, made informed.
//
// Tone rules (locked, applied here):
//   - No em-dashes anywhere
//   - No marketing-teaser quotes
//   - No AI-slop "That's the whole thing"-style closers
//   - Calm Apple-Settings register
//   - Honest about the no-silent-autopay stance (it's a feature
//     of the locked subscription discipline, worth surfacing)

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type ParentHandoffSubscriptionInput = {
  to: string;
  parentFirstName?: string | null;
  childFirstName: string;
  planLabel: string; // "Kiddo+" | "Kiddo Family"
  manageSubscriptionUrl: string; // /settings?tab=membership
};

export function buildParentHandoffSubscriptionEmail(
  input: ParentHandoffSubscriptionInput,
): EmailMessage {
  const { to, parentFirstName, childFirstName, planLabel, manageSubscriptionUrl } = input;

  const greeting = parentFirstName && parentFirstName.trim()
    ? `Hi ${parentFirstName.trim()},`
    : "Hi there,";

  const intro = [
    greeting,
    ``,
    `${childFirstName}'s fund is legally ${childFirstName}'s now. Since this was your only managed fund, your ${planLabel} subscription does not gate anything for you anymore.`,
    ``,
    `Two options, both fine:`,
    ``,
    `1. Cancel it. One click on the manage subscription page. Nothing else changes. You keep your Kiddo account and can still contribute as a gifter through any kid's gift link.`,
    ``,
    `2. Keep it active. If you might open a fund for another kid (or for yourself) later, the subscription gates premium features the moment a new fund appears. No re-subscribing required.`,
    ``,
    `We are emailing you about this because our locked rule is no silent autopay through a subscription that does nothing for you. We are also not going to pester you about it. One email, your call, done.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `About your ${planLabel} subscription`,
    intro,
    cta: { text: `Manage subscription`, url: manageSubscriptionUrl },
    postscript: `If you do nothing, the subscription stays active at the same price. You can change your mind any time.`,
  });

  const text = [
    greeting,
    ``,
    `${childFirstName}'s fund is legally ${childFirstName}'s now. Since this was your only managed fund, your ${planLabel} subscription does not gate anything for you anymore.`,
    ``,
    `Two options, both fine:`,
    ``,
    `1. Cancel it. One click on the manage subscription page. Nothing else changes. You keep your Kiddo account and can still contribute as a gifter through any kid's gift link.`,
    ``,
    `2. Keep it active. If you might open a fund for another kid (or for yourself) later, the subscription gates premium features the moment a new fund appears. No re-subscribing required.`,
    ``,
    `We are emailing you about this because our locked rule is no silent autopay through a subscription that does nothing for you. We are also not going to pester you about it. One email, your call, done.`,
    ``,
    `Manage subscription: ${manageSubscriptionUrl}`,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: `${childFirstName} is the owner now. About your ${planLabel} subscription.`,
    text,
    html,
    tags: ["parent-handoff-subscription"],
    metadata: { kind: "parent_handoff_subscription", plan: planLabel },
  };
}
