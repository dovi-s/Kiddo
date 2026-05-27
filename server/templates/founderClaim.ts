// Founding-member claim email. Two intents share this template:
//
//   - 'launch':  the bulk launch-announcement ("Kiddo is live — claim your
//     Founder account"), fired by the one-off launch script (spec Day-5 / task
//     #7) for every unclaimed founder.
//   - 'reissue': fired by POST /api/auth/founder-claim/request when a founder
//     lost the original email and re-requests their link from the claim page.
//
// Security: the raw token rides in the URL; the DB stores SHA-256(token) in
// founding_members.claim_token. Single-use, 30-day TTL (founders may act on the
// launch email days later). Anti-enumeration: the request route returns 200
// regardless of whether the email belongs to a founder, so this email only
// fires when there IS an unclaimed founder row.
//
// Per project_founding_member_claim_flow_spec.md (decisions locked 2026-05-26).

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type FounderClaimInput = {
  to: string;
  claimUrl: string;
  firstName?: string | null;
  position: number;
  intent: "launch" | "reissue";
};

export function buildFounderClaimEmail(input: FounderClaimInput): EmailMessage {
  const { to, claimUrl, firstName, position, intent } = input;
  const greeting = firstName && firstName.trim() ? `Hi ${firstName.trim()},` : "Hi there,";

  let heading: string;
  let subject: string;
  let intro: string;
  const cta = "Claim your Founder account";
  const postscript =
    "This link is yours alone and good for 30 days. If you didn't sign up to be a Kiddo founding member, you can safely ignore this email.";

  if (intent === "launch") {
    heading = "Kiddo is live";
    subject = "Kiddo is live. Claim your Founder account";
    intro = `${greeting} You're founding member #${position}. Kiddo is officially live, and your founder benefits are ready: your $19/year price locked for life, a $25 starter gift for your first fund, the Founding Member badge, and early access to everything we build next. Tap below to set up your account. It takes about a minute, no password required.`;
  } else {
    heading = "Your Founder claim link";
    subject = "Your Kiddo Founder claim link";
    intro = `${greeting} Here's a fresh link to claim your founding member account (#${position}). Your $19/year lifetime price, $25 starter gift, and Founding Member badge are waiting. Any earlier link is now inactive.`;
  }

  const { html } = renderKiddoEmail({ heading, intro, cta: { text: cta, url: claimUrl }, postscript });

  const text = [
    intent === "launch" ? "Kiddo is live." : "Your Kiddo Founder claim link.",
    "",
    intro,
    "",
    "Claim your account (link good for 30 days):",
    claimUrl,
    "",
    postscript,
    "",
    "The Kiddo team",
  ].join("\n");

  return {
    to,
    subject,
    text,
    html,
    tags: [intent === "launch" ? "founder-launch" : "founder-reissue"],
    metadata: { kind: `founder_claim_${intent}`, position },
  };
}
