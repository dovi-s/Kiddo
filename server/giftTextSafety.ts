// Shared trust-safety validation for gifter-authored text + the gifter
// blocklist — T&S audit items H2 (name/message contact-info), H9 (links/
// shorteners in message bodies), H6/H7 (blocklist on ALL gift paths), M4
// (machine transcripts). Extracted 2026-06-06 from the one-time checkout's
// inline rules so every public gifter surface (one-time, recurring,
// gift-intents, guestbook, post-payment note) enforces the SAME policy —
// the audit found the rules existed on exactly one of five endpoints.
//
// Why these rules at all: gifter text renders on child-facing surfaces
// (Memory Book / Kid View). A name or note is not a place for a URL, email,
// phone number, or @handle — each is a contact channel from a stranger to a
// child (grooming vector) or a phishing vector aimed at the family. Family
// titles ("Grandma", "Uncle Bob") stay untouched; this is contact-pattern
// matching, not content moderation (that's the separate H1 decision).

import { db } from "./db";
import { sql } from "drizzle-orm";

// Contact patterns: URLs, www, emails, @handles, phone-like digit runs
// (8+ chars of digits/dots/parens/spaces/hyphens). Same regex the one-time
// checkout shipped with; kept byte-identical so behavior there is unchanged.
const CONTACT_INFO_RE = /https?:\/\/|www\.|\S+@\S+\.\S+|@\w{2,}|\d[\d().\s-]{6,}\d/;

// Brand/staff impersonation names — a stranger signing as "Kiddo Support"
// inside a child's Memory Book is a phishing primitive.
const STAFF_NAMES = new Set([
  "admin", "administrator", "support", "support team", "customer support",
  "moderator", "official", "system", "the team", "the kiddo team",
]);

// Links for MESSAGE bodies: full URLs, www, and the common shortener/landing
// domains that dodge a naive https? check. Bare-domain detection beyond this
// list is deliberately omitted — "love you. mom" must never bounce.
const LINK_OR_SHORTENER_RE = /https?:\/\/|www\.|\b(?:bit\.ly|t\.co|tinyurl\.com|tiny\.cc|goo\.gl|is\.gd|cutt\.ly|rb\.gy|ow\.ly|buff\.ly|rebrand\.ly|shorturl\.at|linktr\.ee)\b/i;

// Validate a gifter's NAME field. Returns a user-facing error string, or null
// when the name is fine. Anonymous gifts skip entirely (no name renders).
export function senderNameIssue(rawName: unknown, isAnonymous = false): string | null {
  if (isAnonymous) return null;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return null; // emptiness is the caller's required-field decision
  if (CONTACT_INFO_RE.test(name)) {
    return "Please use a real name — links, emails, phone numbers, and @handles aren't allowed in the name.";
  }
  const lower = name.toLowerCase();
  if (lower.includes("kiddo") || STAFF_NAMES.has(lower)) {
    return "That name isn't available. Please sign your gift with your own name.";
  }
  return null;
}

// Validate a gifter-authored MESSAGE/NOTE body. Returns a user-facing error
// string, or null when the text is fine. Two tiers with distinct copy so the
// gifter knows exactly what to fix.
export function giftMessageIssue(rawText: unknown): string | null {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) return null;
  if (LINK_OR_SHORTENER_RE.test(text)) {
    return "Links can't go in a gift note. Just words, from you to them.";
  }
  if (CONTACT_INFO_RE.test(text)) {
    return "Gift notes can't include emails, phone numbers, or @handles. Just words, from you to them.";
  }
  return null;
}

// M4 — machine-generated transcript text (Whisper output rendered to the
// child). Unlike gifter-typed text we can't bounce it back with an error
// (the gifter didn't type it and may have already left); on a contact-pattern
// hit the transcript is DROPPED (audio itself stays — it passed its own gate)
// rather than rendered. Returns the transcript or null.
export function sanitizeTranscript(rawTranscript: unknown): string | null {
  const text = typeof rawTranscript === "string" ? rawTranscript.trim() : "";
  if (!text) return null;
  if (LINK_OR_SHORTENER_RE.test(text) || CONTACT_INFO_RE.test(text)) return null;
  return text;
}

// H6/H7 — gifter blocklist, enforced on every gift path. Global blocks always
// match; fund-scoped blocks match when fundId is provided (pass null where no
// fund context exists yet, e.g. gift-intents — global blocks still apply:
// `fund_id = NULL` simply never matches). Errors propagate to the endpoint's
// catch — same behavior as the original inline check.
export async function isSenderBlocked(rawEmail: unknown, fundId: string | null): Promise<boolean> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email) return false;
  const rows = await db.execute(sql`
    SELECT id FROM blocked_gifters
    WHERE unblocked_at IS NULL
      AND email = ${email}
      AND (scope = 'global' OR (scope = 'fund' AND fund_id = ${fundId}))
    LIMIT 1
  `);
  return Boolean((rows.rows || [])[0]);
}

// The deliberately vague refusal — never confirm to a bad actor that they are
// specifically blocked. Shared so every path returns the identical shape.
export const SENDER_BLOCKED_RESPONSE = {
  error: "sender_blocked",
  message: "This gift cannot be processed. If you believe this is a mistake, contact support@kiddofund.com.",
} as const;
