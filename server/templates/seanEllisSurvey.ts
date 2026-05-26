// Sean Ellis PMF survey email. The single quantitative PMF test
// (locked 2026-05-26 per project_launch_wedge_and_creator_distribution.md):
//
//   "How would you feel if you could no longer use Kiddo?"
//     → Very disappointed / Somewhat disappointed / Not disappointed
//
// 40% Very-Disappointed is the canonical threshold. Below 40% sustained
// over 4 weeks = pivot before scaling creator spend. At 40%+ = scale.
//
// Why a real email, not a Typeform/Tally redirect:
//   - The link goes in the recipient's inbox as plain HTML. One tap,
//     answer captured. No third-party survey service in the loop, no
//     branded chrome from a tool that isn't ours, no friction.
//   - Each response option is a separate link with the response value
//     baked into the URL. The page records the response on load
//     and only THEN asks the optional "why?" note. Single-tap captures
//     the binary signal; the optional note captures the qualitative.
//   - Three links instead of one button means the recipient commits
//     in the inbox, before the page even loads. The dropoff from
//     "click link" to "click response button" disappears.
//
// Tone discipline:
//   - Subject opens with the question. Not "we'd love your feedback."
//     Not "quick favor." The recipient's inbox subject line is the
//     question itself. If they don't answer, the subject still
//     planted the question.
//   - The body is short. No marketing chrome. The three response
//     links are big and obvious.
//   - "If you've got a minute, tell us why" framing for the note.
//     Optional, no obligation, no guilt.

import type { EmailMessage } from "../emailDelivery";
import { renderKiddoEmail } from "./baseTemplate";

export type SeanEllisSurveyInput = {
  to: string;
  firstName?: string | null;
  surveyBaseUrl: string; // e.g. "https://kiddofund.com/feedback/pmf"
};

export function buildSeanEllisSurveyEmail(input: SeanEllisSurveyInput): EmailMessage {
  const { to, firstName, surveyBaseUrl } = input;
  const safeName = firstName?.trim() || "";
  const greeting = safeName ? `Hi ${safeName},` : "Hi there,";

  const emailParam = encodeURIComponent(to);
  const linkVD = `${surveyBaseUrl}?r=vd&e=${emailParam}`;
  const linkSD = `${surveyBaseUrl}?r=sd&e=${emailParam}`;
  const linkND = `${surveyBaseUrl}?r=nd&e=${emailParam}`;

  const heading = "How would you feel if you could no longer use Kiddo?";
  const subject = "How would you feel if you could no longer use Kiddo?";

  const intro = [
    `${greeting} One question. Single tap to answer.`,
    ``,
    `If Kiddo went away tomorrow, how would you feel?`,
  ].join("\n");

  // The three response options render as full-width buttons in the
  // HTML. renderKiddoEmail's CTA arg only supports one button, so we
  // build the buttons block ourselves below and pass it as a custom
  // postscript-style block via the intro stitch.
  const postscript = "Whichever you pick, we read every reply. If you've got a minute on the next screen, tell us why.";

  // We need three buttons, not one. Build a custom HTML block by
  // composing the existing template + a buttons-block postscript.
  // The baseTemplate's renderKiddoEmail only supports one CTA, so we
  // omit it and render the three-button row inside the postscript.
  // This keeps the email rendering within the existing brand chrome.
  const { html: baseHtml } = renderKiddoEmail({
    heading,
    intro,
    postscript,
  });

  // Inject the three-button block AFTER the intro paragraphs, BEFORE
  // the postscript. The base template doesn't expose a slot for this,
  // so we patch the HTML by replacing the postscript marker with the
  // button block + the original postscript. This is the minimum
  // invasive change to ship the three-link layout without touching
  // the base template, which other emails depend on.
  const buttonsBlock = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 14px 0 6px 0;">
          <tr>
            <td style="padding-bottom: 10px;">
              <a href="${linkVD}" style="display: block; text-align: center; background-color: #1B4332; color: #FFFFFF; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; padding: 14px 18px; border-radius: 14px;" target="_blank" rel="noopener">Very disappointed</a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 10px;">
              <a href="${linkSD}" style="display: block; text-align: center; background-color: #FAF8F4; color: #1A1710; text-decoration: none; border: 1px solid rgba(26,23,16,0.18); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; padding: 14px 18px; border-radius: 14px;" target="_blank" rel="noopener">Somewhat disappointed</a>
            </td>
          </tr>
          <tr>
            <td>
              <a href="${linkND}" style="display: block; text-align: center; background-color: #FAF8F4; color: #1A1710; text-decoration: none; border: 1px solid rgba(26,23,16,0.18); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; padding: 14px 18px; border-radius: 14px;" target="_blank" rel="noopener">Not disappointed</a>
            </td>
          </tr>
        </table>`;

  // The base template renders the postscript paragraph with a known
  // style signature; splice the buttons in just before it.
  const postscriptOpenMarker = `<p style="margin: 18px 0 0 0;`;
  const html = baseHtml.includes(postscriptOpenMarker)
    ? baseHtml.replace(postscriptOpenMarker, `${buttonsBlock}<p style="margin: 18px 0 0 0;`)
    : baseHtml + buttonsBlock;

  const text = [
    heading,
    ``,
    `${greeting} One question, single tap to answer.`,
    ``,
    `If Kiddo went away tomorrow, how would you feel?`,
    ``,
    `Very disappointed: ${linkVD}`,
    `Somewhat disappointed: ${linkSD}`,
    `Not disappointed: ${linkND}`,
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
    tags: ["pmf-survey"],
    metadata: { kind: "pmf_survey" },
  };
}
