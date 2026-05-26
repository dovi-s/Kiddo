// Founding Member welcome email. Fires once per signup from the
// /api/waitlist/founding-members route the moment the JSONL append
// succeeds. The signup itself is non-transactional (no card charge,
// no DriveWealth handshake) so the email is the only confirmation
// the user gets outside the success card on the page.
//
// Tone discipline (locked 2026-05-26 alongside the
// project_launch_wedge_and_creator_distribution.md frame):
//   - "You're in" register, not marketing register. Apple-Settings
//     warmth, not promo-blast warmth.
//   - Restates the deal in one line so the email is self-contained
//     if the recipient deletes it for six months and comes back.
//   - Names a number — position + cap — because scarcity is the
//     value mechanism. Without the number the email reads generic.
//   - No CTA button in v1. Founders have nothing to DO at signup;
//     the next action is "wait for launch." A button would invite
//     them to click into a UI surface that doesn't yet serve them.
//     If/when the claim flow ships (see
//     project_founding_member_claim_flow_spec.md) we'll add a CTA.
//   - "We won't spam you" promise stated explicitly. The advocacy
//     deal needs trust that the inbox cost is bounded.
//   - No em-dashes. No "facilitate", "leverage", "seamlessly",
//     "empower". Existing lint enforces these.
//
// One template, one intent. Future expansion (launch announcement,
// claim-link reminder, post-claim welcome) gets its own file rather
// than overloading this one.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type FoundingMemberWelcomeInput = {
  to: string;
  firstName: string;
  position: number;
  cap: number;
};

export function buildFoundingMemberWelcomeEmail(input: FoundingMemberWelcomeInput): EmailMessage {
  const { to, firstName, position, cap } = input;

  const safeName = firstName.trim();
  const greeting = safeName ? `Hi ${safeName},` : "Hi there,";

  const heading = "You're in, Founder.";
  const subject = `You're in. Founding member #${position} of ${cap.toLocaleString()}.`;

  const intro = [
    `${greeting} You're founding member #${position} of ${cap.toLocaleString()}.`,
    ``,
    `When Kiddo launches, we'll email you the founder-only signup link. It locks in your $19/year Plus rate for life, drops $25 of starter credit into your first fund, and puts the Founding Member badge on every gift link you share.`,
    ``,
    `Until launch, we won't spam you. The quarterly founder survey we actually read, the occasional preview of a feature we're considering, and the launch itself. That's it.`,
  ].join("\n");

  const postscript = "If you change your mind, reply to this email and we'll remove you from the founders list. Otherwise we'll see you at launch.";

  const { html } = renderKiddoEmail({
    heading,
    intro,
    postscript,
  });

  const text = [
    heading,
    ``,
    intro,
    ``,
    postscript,
    ``,
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject,
    text,
    html,
    tags: ["founding-member-welcome"],
    metadata: { kind: "founding_member_welcome", position, cap },
  };
}
