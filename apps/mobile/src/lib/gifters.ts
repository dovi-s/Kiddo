// Test/seed-junk gifter detector. MIRRORS shared/test-content.ts
// (looksLikeTestSender) so every native surface that lists gifters by identity
// (Home who-loves + recent carousel, Gift recent-gifts) hides dev/seed junk
// like "test", "qqqqq", or repeated-char mash. Anonymous / "Someone" fallbacks
// pass through. Kept in sync with the server predicate.

const TEST_SENDER_TOKEN_RE = /^(test|testing|tstgin|tstng|qqqqq|tester)\b/i;
const REPEATED_CHAR_RE = /^([a-z])\1{2,}$/i;

export function looksLikeTestSender(name?: string | null, email?: string | null): boolean {
  const n = String(name || "").trim();
  if (TEST_SENDER_TOKEN_RE.test(n)) return true;
  const compact = n.replace(/\s+/g, "");
  if (compact && REPEATED_CHAR_RE.test(compact)) return true;
  const localPart = String(email || "").trim().toLowerCase().split("@")[0] || "";
  if (localPart && TEST_SENDER_TOKEN_RE.test(localPart)) return true;
  return false;
}
