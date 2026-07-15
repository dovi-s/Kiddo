// Gift checkout draft persistence — regression tests for the pure logic in
// client/src/lib/giftDraft.ts (the sessionStorage draft that lets a composed
// gift survive refresh + the Stripe-cancel return path). The invariant that
// matters most: a credential can NEVER reach storage — serialization is an
// explicit allowlist, and this file proves it.
//
// Run: npm run test:gift-draft

import assert from "node:assert/strict";
import {
  GIFT_DRAFT_PREFIX,
  GIFT_DRAFT_TTL_MS,
  buildGiftDraftKey,
  isMeaningfulGiftDraft,
  parseGiftDraft,
  serializeGiftDraft,
  type GiftDraftFields,
} from "../client/src/lib/giftDraft";

const NOW = 1_770_000_000_000;

const composed: GiftDraftFields = {
  step: "preview",
  selectedAmount: 100,
  showCustom: true,
  customAmount: "75",
  executionModel: "pick",
  selectedStock: "DIS",
  senderName: "Grandma Ruth",
  senderEmail: "ruth@example.com",
  isAnonymous: false,
  message: "Happy birthday, sweetheart. Watch this grow with you.",
  memoryAttachmentMode: "voice",
  photoUrl: "/uploads/memory/photo-1.jpg",
  videoUrl: "",
  audioUrl: "/uploads/memory/voice-1.webm",
  giftAddOn: "none",
  isRecurring: true,
  recurringFrequency: "monthly",
};

// ── Key building ──────────────────────────────────────────────────────────
assert.equal(buildGiftDraftKey("emma-fund", "bday-7"), `${GIFT_DRAFT_PREFIX}emma-fund:bday-7`);
assert.equal(buildGiftDraftKey("emma-fund", null), `${GIFT_DRAFT_PREFIX}emma-fund:`);
assert.equal(buildGiftDraftKey(undefined, undefined), `${GIFT_DRAFT_PREFIX}:`);
assert.ok(buildGiftDraftKey("a", "b").startsWith(GIFT_DRAFT_PREFIX)); // GiftSuccess clears by this prefix

// ── Round-trip: everything composed comes back exactly ────────────────────
{
  const restored = parseGiftDraft(serializeGiftDraft(composed, NOW), NOW + 60_000);
  assert.ok(restored, "fresh draft must parse");
  assert.deepEqual(restored, composed);
}

// ── THE security invariant: a credential never reaches storage ────────────
{
  const leaky = { ...composed, recurringPassword: "hunter2-super-secret", sessionToken: "tok_abc" } as any;
  const raw = serializeGiftDraft(leaky, NOW);
  assert.ok(!raw.includes("hunter2-super-secret"), "password must never be serialized");
  assert.ok(!raw.includes("tok_abc"), "unknown extra fields must be dropped by the allowlist");
  const restored = parseGiftDraft(raw, NOW)!;
  assert.ok(!("recurringPassword" in restored));
  assert.ok(!("sessionToken" in restored));
}

// ── TTL: stale-tab drafts die; the boundary is inclusive ──────────────────
{
  const raw = serializeGiftDraft(composed, NOW);
  assert.ok(parseGiftDraft(raw, NOW + GIFT_DRAFT_TTL_MS), "draft at exactly TTL still restores");
  assert.equal(parseGiftDraft(raw, NOW + GIFT_DRAFT_TTL_MS + 1), null, "draft past TTL must not restore");
}

// ── Untrusted storage: malformed / wrong version / missing → null ─────────
assert.equal(parseGiftDraft(null, NOW), null);
assert.equal(parseGiftDraft("", NOW), null);
assert.equal(parseGiftDraft("{not json", NOW), null);
assert.equal(parseGiftDraft(JSON.stringify({ v: 2, ts: NOW }), NOW), null, "future versions must not restore");
assert.equal(parseGiftDraft(JSON.stringify({ v: 1 }), NOW), null, "missing timestamp must not restore");

// ── Field validation: garbage values are dropped, good ones survive ───────
{
  const tampered = JSON.parse(serializeGiftDraft(composed, NOW));
  tampered.step = "checkout-bypass";
  tampered.selectedAmount = 3; // below the $5 floor
  tampered.executionModel = "yolo";
  tampered.recurringFrequency = "daily";
  tampered.memoryAttachmentMode = "exe";
  tampered.isAnonymous = "yes"; // wrong type
  const restored = parseGiftDraft(JSON.stringify(tampered), NOW)!;
  assert.ok(restored, "partial garbage must not kill the whole draft");
  assert.equal(restored.step, undefined);
  assert.equal(restored.selectedAmount, undefined);
  assert.equal(restored.executionModel, undefined);
  assert.equal(restored.recurringFrequency, undefined);
  assert.equal(restored.memoryAttachmentMode, undefined);
  assert.equal(restored.isAnonymous, undefined);
  // ...while untampered fields still come through:
  assert.equal(restored.message, composed.message);
  assert.equal(restored.senderName, composed.senderName);
  assert.equal(restored.audioUrl, composed.audioUrl);
}

// ── All three valid execution models survive (incl. "family") ─────────────
for (const model of ["auto", "pick", "family"] as const) {
  const restored = parseGiftDraft(serializeGiftDraft({ ...composed, executionModel: model }, NOW), NOW)!;
  assert.equal(restored.executionModel, model);
}

// ── Meaningful predicate: pristine landing writes nothing; any compose does ─
{
  const pristine: GiftDraftFields = {
    step: "landing",
    selectedAmount: 50,
    showCustom: false,
    customAmount: "",
    executionModel: "auto",
    selectedStock: null,
    senderName: "",
    senderEmail: "",
    isAnonymous: false,
    message: "",
    memoryAttachmentMode: "none",
    photoUrl: "",
    videoUrl: "",
    audioUrl: "",
    giftAddOn: "none",
    isRecurring: false,
    recurringFrequency: "monthly",
  };
  assert.equal(isMeaningfulGiftDraft(pristine), false, "untouched landing must not write a draft");
  assert.equal(isMeaningfulGiftDraft({ ...pristine, message: "hi" }), true);
  assert.equal(isMeaningfulGiftDraft({ ...pristine, message: "   " }), false, "whitespace-only is not composed");
  assert.equal(isMeaningfulGiftDraft({ ...pristine, step: "amount" }), true, "advancing past landing counts");
  assert.equal(isMeaningfulGiftDraft({ ...pristine, senderName: "Ruth" }), true);
  assert.equal(isMeaningfulGiftDraft({ ...pristine, photoUrl: "/u/p.jpg" }), true);
  assert.equal(isMeaningfulGiftDraft({ ...pristine, audioUrl: "/u/v.webm" }), true);
  assert.equal(isMeaningfulGiftDraft({ ...pristine, customAmount: "75" }), true);
}

console.log("gift draft tests passed");
