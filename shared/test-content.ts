// Canonical test/dev-junk detector for gift SENDER IDENTITY (name/email).
//
// Why this exists: the codebase already filters test-pattern JUNK out of
// MESSAGE content at gift checkout (server/routes.ts memory-share
// validator) and at Memory Book entry creation (server/webhookHandlers.ts)
// — but those filters look at the message body, not the sender's name or
// email. So a dev/seed gift from "test" or "qqqqq" still rendered as a
// band/row on every surface that aggregates gifters by identity:
//   - the community self-portrait (Dashboard + KidView),
//   - the public fund + public event "recent gifters" social proof,
//   - the cross-fund "Gifters across funds" sheet,
//   - the public Memory Book gift backfill.
//
// Centralizing the predicate here gives every one of those surfaces ONE
// vetted rule instead of N copies that drift. The token list mirrors the
// existing message-level regex so behavior stays consistent across the
// app.
//
// Distinct from the USER-level `isTestUser` flag, which gates a test
// PARENT's whole fund out of KidView (server/routes.ts). That flag does
// nothing for junk GIFTERS, who usually have no account to flag — this
// predicate is the gifter-side equivalent.

// Standalone test tokens. `\b`-anchored so it matches "test" / "Test User"
// / "tester" but NOT real names like "Testa" or "Tessa".
export const TEST_SENDER_TOKEN_RE = /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i;

// Repeated single character ("qqqqq", "aaaa", "zzz") — classic keyboard-
// mash seed data.
export const REPEATED_CHAR_RE = /^([a-z])\1{2,}$/i;

/**
 * True when a gift's sender identity looks like dev/test/seed junk rather
 * than a real person. Checks the display name, the name with whitespace
 * stripped (repeated-char mash), and the local-part of the email.
 *
 * Anonymous gifts are unaffected: an empty name, or the "Someone who loves
 * {child}" fallback, matches none of these patterns and passes through.
 */
export function looksLikeTestSender(name?: string | null, email?: string | null): boolean {
  const n = String(name || "").trim();
  if (TEST_SENDER_TOKEN_RE.test(n)) return true;
  const compact = n.replace(/\s+/g, "");
  if (compact && REPEATED_CHAR_RE.test(compact)) return true;
  const localPart = String(email || "").trim().toLowerCase().split("@")[0] || "";
  if (localPart && TEST_SENDER_TOKEN_RE.test(localPart)) return true;
  return false;
}
