// Regression tests for server/giftTextSafety.ts — the shared T&S policy
// (audit items H2/H9/M4) enforced on every public gifter text path. Two
// jobs: (1) the contact/link patterns actually catch what they claim,
// (2) REAL warm gift language never trips them — including every message
// style the Dunphy demo seeds, which double as canaries for false positives.
//
// Run: npm run test:gift-text-safety

import assert from "node:assert/strict";
import { senderNameIssue, giftMessageIssue, sanitizeTranscript } from "../server/giftTextSafety";
// giftTextSafety transitively imports server/db, which opens the Postgres
// pool. The pool's idle connections (plus the warm-pool heartbeat) keep
// Node's event loop alive, so without closing it this pure-logic test never
// self-exits — it just sits there after the assertions pass. Close it at the
// end, same convention as the DB-touching tests (test-security-regression et al).
import { pool } from "../server/db";

// ── Names: real gifter signatures stay legal ───────────────────────────────
for (const ok of [
  "Grandma", "Uncle Bob", "Gloria Pritchett", "The Nguyens next door",
  "Phil's office", "Aunt Pam", "Grandma & Grandpa", "Mr. O'Brien-Smith",
]) {
  assert.equal(senderNameIssue(ok), null, `name should pass: ${ok}`);
}

// Names: contact channels + impersonation are refused (incl. protocol-less
// shorteners — a hole the first version of the module had; found by this test)
for (const bad of [
  "grandma@example.com", "Call 555-123-4567", "https://evil.example",
  "www.evil.example", "@cooluncle22", "Kiddo Support", "admin", "The Kiddo Team",
  "visit bit.ly/free",
]) {
  assert.ok(senderNameIssue(bad) !== null, `name should be refused: ${bad}`);
}

// Anonymous skips name policing entirely (no name renders anywhere)
assert.equal(senderNameIssue("https://whatever", true), null);
// Empty name is the caller's required-field decision, not ours
assert.equal(senderNameIssue(""), null);
assert.equal(senderNameIssue(undefined), null);

// ── Messages: every seeded demo message stays legal (false-positive canaries) ─
for (const seeded of [
  "adding a little extra this month bud. dad",
  "good bonus this year, threw some in. dad",
  "Merry Christmas. Grandpa",
  "invest it, don't blow it",
  "more Disney money, obviously 😄",
  "para tu futuro mi vida. besos",
  "love you sweetheart",
  "from the whole office! 🎉",
  "because magic is always a good investment",
  "abuela te quiere muchisimo",
  "Apple again. you'll thank me.",
  "don't tell Mitchell i went bigger this year",
  "llamame ok? te amo",
  "another year, another share.",
  "for college. or whatever you choose",
  "Proud of you, kid.",
  "Happy birthday!!",
  "feliz cumpleaños mi amor!! te amo te amo ❤",
  "you basically live on this thing, might as well own a piece. dad",
  "Almost there, kid. Grandpa",
  "Buy low. Grandpa",
  "pensando en ti hoy mi amor ❤ llamame",
  "❤",
  "Congrats kid. Grandpa",
  "CONGRATS GRAD!! 🎓",
  "Happy 10th birthday! $50 now, more when you graduate.",
  "Class of 2033, here you come",
]) {
  assert.equal(giftMessageIssue(seeded), null, `seeded-style message should pass: ${seeded}`);
}

// Messages: links, shorteners, and contact channels are refused
for (const bad of [
  "check out https://totally-legit.example",
  "go to www.free-money.example now",
  "claim it at bit.ly/abc123",
  "tinyurl.com/xyz has your gift",
  "find me on linktr.ee/cooluncle",
  "email me at uncle@example.com",
  "text me at 555-123-4567",
  "my cell is (212) 555 0199 call anytime",
  "follow me @cooluncle22",
]) {
  assert.ok(giftMessageIssue(bad) !== null, `message should be refused: ${bad}`);
}

// Documented tradeoff: hyphen/space-separated digit runs that LOOK like phone
// numbers are refused even when they're dates ("11-04-2033"). Intentional —
// the child-contact risk outweighs the rare hyphenated-date note, and the
// error copy tells the gifter exactly what to rephrase.
assert.ok(giftMessageIssue("see you on 11-04-2033") !== null);
// ...while slash dates (the common US style) pass untouched:
assert.equal(giftMessageIssue("see you on 11/4/2033"), null);
assert.equal(giftMessageIssue("born 11/04/2026, gifted the same week"), null);

// Empty/absent messages are fine (message is optional everywhere)
assert.equal(giftMessageIssue(""), null);
assert.equal(giftMessageIssue(undefined), null);

// ── Transcripts (M4): machine text is dropped on a hit, kept verbatim otherwise ─
assert.equal(sanitizeTranscript("Happy birthday Luke, we love you so much"), "Happy birthday Luke, we love you so much");
assert.equal(sanitizeTranscript("call me at 555 123 4567 don't tell mom"), null, "contact-pattern transcript must be dropped");
assert.equal(sanitizeTranscript("visit www.evil.example for a surprise"), null);
assert.equal(sanitizeTranscript(""), null);
assert.equal(sanitizeTranscript(undefined), null);

console.log("gift text safety tests passed");

await pool.end().catch(() => undefined);
