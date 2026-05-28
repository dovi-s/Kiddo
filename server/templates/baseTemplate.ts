// renderKiddoEmail, the single canonical branded HTML wrapper for
// every transactional email Kiddo sends.
//
// Created 2026-05-15. Before this helper existed, every email worker
// (gifter, parent-lifecycle, recurring, age-transition, gift-intent
// expiry, stalled-handoff, post-handoff engagement) composed its
// own plain-text body inline. Twenty-plus emails, zero brand
// consistency. The first consumer is the forgot-password email
// (same commit); subsequent worker emails should migrate over
// in follow-up branches.
//
// Design rules (locked):
//   - Inline styles only. Gmail / Outlook strip <style> blocks.
//   - Table-based layout for the centered card. CSS layout breaks
//     in Outlook desktop and several mobile clients.
//   - System fonts via -apple-system stack. NEVER load remote fonts
//     (rendering delay, privacy, fails in Gmail Promotions tab).
//   - Cream background (#F9F7F3) + evergreen accent (#1B4332) +
//     warm body text (#5F5548). Matches the in-app palette so the
//     email and the destination dashboard feel like one product.
//   - No em-dashes anywhere in the chrome (locked rule applies to
//     email copy too).
//   - No marketing teaser quotes, no AI-slop sparkles, no rotating
//     gradient backgrounds. Apple-Settings register applied to
//     email, minimal chrome, content forward.
//   - Footer carries the legal entity name (Kiddo, Inc.), the support
//     link, and the unsubscribe URL when caller provides one.
//
// API:
//   renderKiddoEmail({
//     heading: string;              // sentence-case h1, no em-dashes
//     intro: string;                // body copy, supports basic \n -> <br>
//     cta?: { text, url };          // optional primary button
//     postscript?: string;          // optional smaller copy below the CTA
//     unsubscribeUrl?: string;      // optional one-click List-Unsub URL
//   }) -> { html: string }
//
// Use this for HTML. Plain-text body still composed by the caller,
// the helper deliberately doesn't try to strip HTML back to text
// because the caller often wants different wording for the two
// (HTML can use a button, text uses the URL).

// We escape user-provided strings the cheap way: only the characters
// that matter in HTML attribute / element contexts. querystring.escape
// doesn't quite fit; rolling our own avoids pulling a 50KB dep.
function esc(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Convert intro text's \n to <br/>. Two consecutive newlines split
// into separate <p> blocks (warmer rhythm than one giant paragraph).
function formatIntro(text: string): string {
  const escaped = esc(text);
  return escaped
    .split(/\n\s*\n/)
    .map((para) => para.replace(/\n/g, "<br/>"))
    .map((para) => `<p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.65; color: #5F5548;">${para}</p>`)
    .join("");
}

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export type KiddoEmailInput = {
  heading: string;
  intro: string;
  cta?: { text: string; url: string };
  postscript?: string;
  unsubscribeUrl?: string;
  // Optional structured details block. Renders as a small bordered
  // key/value table inside the card, BELOW intro and ABOVE cta.
  // Useful for transactional confirmations that need a "for your
  // records" structured block (receipt, tax notice, account change
  // summary) without breaking the warm prose intro above it.
  // Locked 2026-05-19 per the gifter-receipt-grade upgrade.
  details?: Array<{ label: string; value: string }>;
};

export function renderKiddoEmail(input: KiddoEmailInput): { html: string } {
  const { heading, intro, cta, postscript, unsubscribeUrl, details } = input;
  const supportEmail = process.env.SUPPORT_EMAIL || "support@kiddofund.com";
  const baseUrl = (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "https://kiddofund.com").replace(/\/+$/, "");

  // Structured details table (receipt-grade or transaction-summary
  // block). Each row is a label / value pair; the table is bordered
  // and uses tabular-num font feature for amount columns. Renders
  // inline-style only, Outlook + Gmail Promotions tab safe.
  const detailsBlock = Array.isArray(details) && details.length > 0
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 6px 0 18px 0; border: 1px solid rgba(26,23,16,0.10); border-radius: 12px; background-color: #FAF8F4;">
        ${details
          .map((row, i) => `
            <tr>
              <td style="padding: 11px 14px; font-family: ${FONT_STACK}; font-size: 12px; color: rgba(26,23,16,0.55); ${i < details.length - 1 ? "border-bottom: 1px solid rgba(26,23,16,0.06);" : ""} width: 40%;">${esc(row.label)}</td>
              <td style="padding: 11px 14px; font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600; color: #1A1710; ${i < details.length - 1 ? "border-bottom: 1px solid rgba(26,23,16,0.06);" : ""} text-align: right; font-variant-numeric: tabular-nums;">${esc(row.value)}</td>
            </tr>
          `)
          .join("")}
      </table>`
    : "";

  const ctaBlock = cta
    ? `
      <tr>
        <td style="padding: 8px 0 4px 0;">
          <a href="${esc(cta.url)}"
             style="display: inline-block; background-color: #1B4332; color: #FFFFFF; text-decoration: none; font-family: ${FONT_STACK}; font-size: 15px; font-weight: 600; padding: 13px 22px; border-radius: 14px; letter-spacing: 0.005em;"
             target="_blank" rel="noopener">${esc(cta.text)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; line-height: 1.55; color: rgba(26,23,16,0.5); word-break: break-all;">
          Or paste this link into your browser:<br/>
          <span style="color: rgba(26,23,16,0.6);">${esc(cta.url)}</span>
        </td>
      </tr>`
    : "";

  const postscriptBlock = postscript
    ? `<p style="margin: 18px 0 0 0; font-size: 13px; line-height: 1.6; color: rgba(26,23,16,0.55);">${esc(postscript)}</p>`
    : "";

  const unsubscribeBlock = unsubscribeUrl
    ? `<br/><a href="${esc(unsubscribeUrl)}" style="color: rgba(26,23,16,0.4); text-decoration: underline;">Unsubscribe</a>`
    : "";

  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F9F7F3; font-family: ${FONT_STACK};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F9F7F3;">
    <tr><td align="center" style="padding: 32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px;">

        <!-- Brand wordmark -->
        <tr><td style="text-align: center; padding: 8px 0 24px 0;">
          <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 600; color: #1B4332; letter-spacing: 0.01em;">Kiddo</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background-color: #FFFFFF; border: 1px solid rgba(26,23,16,0.10); border-radius: 20px; padding: 32px 28px;">
          <h1 style="margin: 0 0 18px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; line-height: 1.3; font-weight: 600; color: #1A1710;">${esc(heading)}</h1>
          ${formatIntro(intro)}
          ${detailsBlock}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">${ctaBlock}</table>
          ${postscriptBlock}
        </td></tr>

        <!-- Footer -->
        <tr><td style="text-align: center; padding: 24px 16px 8px 16px; font-family: ${FONT_STACK}; font-size: 11px; line-height: 1.6; color: rgba(26,23,16,0.4);">
          Kiddo, Inc. is a technology company, not a broker-dealer.
          Securities offered through DriveWealth, LLC (FINRA/SIPC).<br/>
          <a href="mailto:${esc(supportEmail)}" style="color: rgba(26,23,16,0.45); text-decoration: underline;">${esc(supportEmail)}</a>
          &nbsp;·&nbsp;
          <a href="${esc(baseUrl)}/legal" style="color: rgba(26,23,16,0.45); text-decoration: underline;">Legal &amp; disclosures</a>
          ${unsubscribeBlock}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
