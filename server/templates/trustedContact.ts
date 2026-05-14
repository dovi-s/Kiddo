// Trusted-contact email templates.
//
// FINRA Rule 4512 trusted contacts are who Kiddo reaches when we
// can't reach the account holder. Three scenarios fire today, all
// surfaced from the stalled-handoff worker:
//
//   1. Parent unreachable for 90+ days during age-18 transition.
//      The kid never claimed; the parent never responded to our
//      escalation emails. Trusted contact is the last channel.
//
//   2. Parent appears to have lost account access entirely (multiple
//      failed login attempts, password resets going to bounced
//      emails, etc.). Not implemented yet; reserved for a future
//      account-recovery flow.
//
//   3. Suspected financial exploitation. The Rule 4512 use-case
//      that's hardest to detect programmatically. Reserved for a
//      future admin-triggered path.
//
// The template carefully does NOT grant the trusted contact any
// custodial or financial authority. They are a confirmation /
// intermediary channel only, per Rule 4512. The email guides them
// toward offline-resolution paths (probate court, family attorney,
// the named successor custodian if any) rather than asking them to
// act on Kiddo's behalf.
//
// Tone: calm, factual, no AI-slop, no marketing. The recipient is
// likely in a difficult situation (a relative has died or become
// incapacitated). The email should feel like a careful note from a
// person, not a system.

export type TrustedContactStalledHandoffParams = {
  trustedContactName: string;
  parentDisplayName: string;
  childFirstName: string;
  childMajorityAge: number;
  daysStalled: number;
  successorContactName: string | null;
  fromAddress: string;
  supportUrl: string;
};

export type TrustedContactEmailContent = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Stalled-handoff template. Fired when:
 *   - A fund has reached the kid's majority age (T-0 passed)
 *   - The kid has not claimed the fund (no childClaimedAt)
 *   - At least 90 days have passed since the invite went out
 *   - We've already tried T+7 and T+30 escalations to parent + kid
 *   - The parent has a trusted contact on file
 *
 * The trusted contact gets ONE email in this scenario. We don't
 * pelt them with follow-ups; if they don't engage, the fund stays
 * in stalled-handoff state until the kid eventually surfaces or the
 * parent re-engages.
 */
export function renderStalledHandoffEmail(
  params: TrustedContactStalledHandoffParams,
): TrustedContactEmailContent {
  const {
    trustedContactName,
    parentDisplayName,
    childFirstName,
    childMajorityAge,
    daysStalled,
    successorContactName,
    supportUrl,
  } = params;

  const greeting = trustedContactName ? `Hi ${trustedContactName.split(/\s+/)[0]},` : "Hello,";
  const stalledLabel = daysStalled >= 90
    ? `more than ${Math.floor(daysStalled / 30)} months`
    : `${daysStalled} days`;
  const successorLine = successorContactName
    ? `${parentDisplayName} named ${successorContactName} as a successor custodian when they set up the account. If you can reach them, that's the right next step.`
    : `No successor custodian was named on the account. Resolving this likely requires probate court or a family attorney.`;

  const subject = `${parentDisplayName} listed you as a trusted contact on Kiddo`;

  const text = [
    greeting,
    "",
    `${parentDisplayName} listed you as their trusted contact on Kiddo, an investment account they opened for ${childFirstName}.`,
    "",
    `We're writing because ${childFirstName} turned ${childMajorityAge} and the account is supposed to transfer to them, but we haven't been able to reach ${parentDisplayName} or ${childFirstName} for ${stalledLabel}. The money is safe; nothing has been sold or moved.`,
    "",
    `We're reaching out because you were named as the person to contact in exactly this kind of situation. To be clear about what this means:`,
    "",
    `  - You do NOT have authority over the account. Kiddo cannot grant you that authority and won't ask you to act on the account directly.`,
    `  - You are a confirmation and intermediary channel only, per FINRA Rule 4512.`,
    `  - The assets legally belong to ${childFirstName}. We'll continue holding them until ${childFirstName} can claim them.`,
    "",
    `What would help most:`,
    "",
    `1. If you know where ${parentDisplayName} or ${childFirstName} is, please reach out to them and ask them to log in to Kiddo or reply to one of our emails.`,
    `2. If ${parentDisplayName} has passed away or become unable to manage the account: ${successorLine}`,
    `3. If you don't have current contact information for either of them and don't know what's happened, please reply to this email and let us know. We'll work with you on next steps.`,
    "",
    `If you need to reach us, you can reply to this email or visit ${supportUrl}.`,
    "",
    `Thank you for being someone ${parentDisplayName} trusted enough to list here.`,
    "",
    `The Kiddo team`,
    "",
    `---`,
    `This is a one-time outreach. If you don't respond, we won't continue to email you about this account. You can reply at any time if the situation changes.`,
  ].join("\n");

  // HTML version. Minimal styling, no marketing-feel HTML email
  // chrome. Mirrors the calm Apple-Settings register the rest of
  // the app uses.
  const html = [
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1A1710; line-height: 1.55; font-size: 15px;">`,
    `  <p>${escapeHtml(greeting)}</p>`,
    `  <p>${escapeHtml(parentDisplayName)} listed you as their trusted contact on Kiddo, an investment account they opened for ${escapeHtml(childFirstName)}.</p>`,
    `  <p>We're writing because ${escapeHtml(childFirstName)} turned ${childMajorityAge} and the account is supposed to transfer to them, but we haven't been able to reach ${escapeHtml(parentDisplayName)} or ${escapeHtml(childFirstName)} for ${escapeHtml(stalledLabel)}. The money is safe; nothing has been sold or moved.</p>`,
    `  <p>We're reaching out because you were named as the person to contact in exactly this kind of situation. To be clear about what this means:</p>`,
    `  <ul style="padding-left: 20px;">`,
    `    <li>You do NOT have authority over the account. Kiddo cannot grant you that authority and won't ask you to act on the account directly.</li>`,
    `    <li>You are a confirmation and intermediary channel only, per FINRA Rule 4512.</li>`,
    `    <li>The assets legally belong to ${escapeHtml(childFirstName)}. We'll continue holding them until ${escapeHtml(childFirstName)} can claim them.</li>`,
    `  </ul>`,
    `  <p><strong>What would help most:</strong></p>`,
    `  <ol style="padding-left: 20px;">`,
    `    <li>If you know where ${escapeHtml(parentDisplayName)} or ${escapeHtml(childFirstName)} is, please reach out to them and ask them to log in to Kiddo or reply to one of our emails.</li>`,
    `    <li>If ${escapeHtml(parentDisplayName)} has passed away or become unable to manage the account: ${escapeHtml(successorLine)}</li>`,
    `    <li>If you don't have current contact information for either of them and don't know what's happened, please reply to this email and let us know. We'll work with you on next steps.</li>`,
    `  </ol>`,
    `  <p>If you need to reach us, you can reply to this email or visit <a href="${escapeAttr(supportUrl)}" style="color: #1B3A2D;">${escapeHtml(supportUrl)}</a>.</p>`,
    `  <p>Thank you for being someone ${escapeHtml(parentDisplayName)} trusted enough to list here.</p>`,
    `  <p>The Kiddo team</p>`,
    `  <hr style="border: none; border-top: 1px solid #E5DDD4; margin: 24px 0;">`,
    `  <p style="font-size: 12px; color: #7A7268;">This is a one-time outreach. If you don't respond, we won't continue to email you about this account. You can reply at any time if the situation changes.</p>`,
    `</div>`,
  ].join("\n");

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
