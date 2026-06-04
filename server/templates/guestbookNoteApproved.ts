// "Your note is in" — sent to a guestbook note-leaver when the parent
// approves their note into the Memory Book (POST /api/memory/:id/approve).
//
// This is the loop-closer that makes the guestbook's optional-email field
// honest: the form promises "leave your email and we'll tell you when your
// note joins the story," and this is the telling. One-shot transactional
// (a direct response to the guest's own submission — no List-Unsubscribe
// needed, same class as gift receipts). Deliberately NEVER sent on
// rejection/delete: "the family chose not to include your note" is a
// cruelty nobody needs; silence is the kind path.
//
// The CTA is the gift page — the warm second beat, now landing at the
// guest's warmest possible moment (they just learned the family put their
// words in the kid's permanent book).
import { renderKiddoEmail } from "./baseTemplate";

export function buildGuestbookNoteApprovedEmail(input: {
  to: string;
  guestName: string;
  childFirstName: string;
  giftPageUrl: string;
}): { to: string; subject: string; text: string; html: string; tags: string[]; metadata: Record<string, unknown> } {
  const { to, guestName, childFirstName, giftPageUrl } = input;
  const kidFirst = (childFirstName || "").trim() || "the kiddo";
  const first = (guestName || "").trim().split(/\s+/)[0] || "there";

  const intro = [
    `Hi ${first},`,
    "",
    `The note you left for ${kidFirst} is officially in their Memory Book. ${kidFirst} will read it for years.`,
    "",
    `Thank you for showing up. Words like yours are the part of the fund that money can't buy.`,
  ].join("\n");

  const { html } = renderKiddoEmail({
    heading: `Your note is in ${kidFirst}'s Memory Book 🌱`,
    intro,
    cta: { text: `Add a gift to go with it`, url: giftPageUrl },
    postscript: `No pressure on the gift. Your note already matters.`,
  });

  const text = [
    `Hi ${first},`,
    "",
    `The note you left for ${kidFirst} is officially in their Memory Book. ${kidFirst} will read it for years.`,
    "",
    `Thank you for showing up. Words like yours are the part of the fund that money can't buy.`,
    "",
    `Want to add a gift to go with it? ${giftPageUrl}`,
    `No pressure. Your note already matters.`,
    "",
    `The Kiddo team`,
  ].join("\n");

  return {
    to,
    subject: `Your note is in ${kidFirst}'s Memory Book`,
    text,
    html,
    tags: ["guestbook-note-approved"],
    metadata: { kind: "guestbook_note_approved" },
  };
}
