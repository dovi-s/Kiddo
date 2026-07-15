// Regression tests for gifterIdentityKey (client/src/lib/gifter-name.ts) — the
// shared gifter-dedup key that fixes "same person, different names = duplicate
// rows" in the contributor surfaces. Pure function → testable in the house
// idiom (tsx + node:assert). Run: npm run test:gifter-identity

import assert from "node:assert/strict";
import { gifterIdentityKey } from "../client/src/lib/gifter-name";

// ── THE fix: same email, different names → ONE identity ─────────────────────
const gloriaFull = gifterIdentityKey("Sofia Rivera", "sofia@riverafamily.com");
const gloriaGrandma = gifterIdentityKey("Grandma", "sofia@riverafamily.com");
const gloriaAbuela = gifterIdentityKey("Abuela", "sofia@riverafamily.com");
assert.equal(gloriaFull, gloriaGrandma, "same email, different names must collapse to one key");
assert.equal(gloriaFull, gloriaAbuela);
assert.equal(gloriaFull, "e:sofia@riverafamily.com");

// ── Email is case/whitespace robust (so storage normalization + this agree) ──
assert.equal(
  gifterIdentityKey("G", "  Sofia@RiveraFamily.com "),
  gifterIdentityKey("Sofia Rivera", "sofia@riverafamily.com"),
  "email key must be trimmed + lowercased",
);

// ── THE other fix: same name, DIFFERENT emails → SEPARATE identities ─────────
assert.notEqual(
  gifterIdentityKey("John Smith", "john1@example.com"),
  gifterIdentityKey("John Smith", "john2@example.com"),
  "two different people who share a name must stay separate",
);

// ── No email (manual/cash gifts) → name fallback, UNCHANGED grouping ─────────
assert.equal(gifterIdentityKey("The Johnsons", ""), "n:the johnsons");
assert.equal(gifterIdentityKey("The Johnsons", null), gifterIdentityKey("the johnsons", undefined));
assert.notEqual(gifterIdentityKey("The Johnsons", null), gifterIdentityKey("The Nguyens", null));

// ── Anonymous → one shared bucket, NEVER email-keyed ────────────────────────
assert.equal(gifterIdentityKey("Anonymous", null), "anon");
assert.equal(gifterIdentityKey("anonymous", null), "anon");
assert.equal(gifterIdentityKey("Someone who loves Theo", null), "anon");
assert.equal(gifterIdentityKey("", null), "anon");
assert.equal(gifterIdentityKey(null, null), "anon");
assert.equal(gifterIdentityKey("Sofia", "gloria@x.com", true), "anon", "explicit anonymous flag wins even with name+email");
// Two anonymous gifts (even with different stray emails) share the bucket — the
// roster shows one "Anonymous", matching prior behavior.
assert.equal(gifterIdentityKey("Anonymous", "a@x.com"), gifterIdentityKey("Anonymous", "b@x.com"));

// ── A real person with email is distinct from the anonymous bucket ──────────
assert.notEqual(gifterIdentityKey("Sofia", "gloria@x.com"), "anon");

console.log("gifter identity key tests passed");
