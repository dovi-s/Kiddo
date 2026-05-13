// Critical-path tests for the age-18 transition decision logic.
// Pure-function unit tests — no DB, no email, no time-of-day side effects.
// These cover the decisions that determine whether a kid receives the
// claim email automatically on their 18th birthday. A bug here means
// silent failure on the most consequential moment in the product.
//
// Run: `npx tsx script/test-age18-decisions.ts`
// Or:  `npm run test:age18-decisions`

import assert from "node:assert/strict";
import {
  decideTodayParentVariant,
  shouldAutoSendKidInvite,
  yearOfLifeForDate,
  getAgeMilestoneState,
} from "../shared/age18-decisions";

function testDecideTodayParentVariant() {
  // No email at all → parent gets "missing" prompt
  assert.equal(
    decideTodayParentVariant({ childEmail: null, isVerified: false }),
    "missing",
    "no email → missing variant",
  );
  assert.equal(
    decideTodayParentVariant({ childEmail: "", isVerified: true }),
    "missing",
    "empty email string treated as no email — but the worker passes a normalized null/non-empty string, so this case shouldn't fire in practice; included for defensive coverage",
  );

  // Email present but unverified → don't auto-send to wrong inbox
  assert.equal(
    decideTodayParentVariant({ childEmail: "kid@example.com", isVerified: false }),
    "unverified",
    "email present but unverified → unverified variant",
  );

  // Email present AND verified → kid gets auto-invite, parent gets confirmation
  assert.equal(
    decideTodayParentVariant({ childEmail: "kid@example.com", isVerified: true }),
    "configured",
    "verified email → configured variant",
  );
}

function testShouldAutoSendKidInvite() {
  // Happy path: verified email, no existing token → auto-send
  assert.equal(
    shouldAutoSendKidInvite({
      childEmail: "kid@example.com",
      isVerified: true,
      hasExistingInviteToken: false,
    }),
    true,
    "verified + no existing token → auto-send",
  );

  // Verified but parent already triggered manually → don't double-send
  assert.equal(
    shouldAutoSendKidInvite({
      childEmail: "kid@example.com",
      isVerified: true,
      hasExistingInviteToken: true,
    }),
    false,
    "existing invite token → don't double-send",
  );

  // Unverified email → don't send (could be wrong address)
  assert.equal(
    shouldAutoSendKidInvite({
      childEmail: "kid@example.com",
      isVerified: false,
      hasExistingInviteToken: false,
    }),
    false,
    "unverified → don't send",
  );

  // No email → can't send
  assert.equal(
    shouldAutoSendKidInvite({
      childEmail: null,
      isVerified: false,
      hasExistingInviteToken: false,
    }),
    false,
    "no email → can't send",
  );

  // Edge: somehow verified but no email (data integrity issue) → don't send
  assert.equal(
    shouldAutoSendKidInvite({
      childEmail: null,
      isVerified: true,
      hasExistingInviteToken: false,
    }),
    false,
    "no email even when verified flag set → don't send (defensive)",
  );
}

function testYearOfLifeForDate() {
  const birthdate = new Date("2008-04-13T00:00:00.000Z");
  const cap = 19;

  // Birthday itself = year 1
  assert.equal(
    yearOfLifeForDate(new Date("2008-04-13T00:00:00.000Z"), birthdate, cap),
    1,
    "birthday → year 1",
  );

  // 1 day after birth = year 1
  assert.equal(
    yearOfLifeForDate(new Date("2008-04-14T00:00:00.000Z"), birthdate, cap),
    1,
    "1 day after birth → year 1",
  );

  // Day before first birthday = year 1
  assert.equal(
    yearOfLifeForDate(new Date("2009-04-12T00:00:00.000Z"), birthdate, cap),
    1,
    "day before first birthday → year 1",
  );

  // First birthday = year 2 (year 1 = birth → 1st birthday inclusive of birth, exclusive of 1st bday)
  assert.equal(
    yearOfLifeForDate(new Date("2009-04-13T00:00:00.000Z"), birthdate, cap),
    2,
    "first birthday → year 2",
  );

  // Mid-childhood: 8 years 6 months in
  assert.equal(
    yearOfLifeForDate(new Date("2016-10-13T00:00:00.000Z"), birthdate, cap),
    9,
    "8.5 years after birth → year 9",
  );

  // 18 years exactly = year 19 (just turned 18)
  assert.equal(
    yearOfLifeForDate(new Date("2026-04-13T00:00:00.000Z"), birthdate, cap),
    19,
    "18 years after birth → year 19",
  );

  // Way after cap → clamps to cap
  assert.equal(
    yearOfLifeForDate(new Date("2050-04-13T00:00:00.000Z"), birthdate, cap),
    cap,
    "long after cap → clamped to cap",
  );

  // Gift dated BEFORE birth (defensive — corrupt data shouldn't crash) → null
  assert.equal(
    yearOfLifeForDate(new Date("2007-12-31T00:00:00.000Z"), birthdate, cap),
    null,
    "gift before birth → null",
  );

  // Invalid gift date → null
  assert.equal(
    yearOfLifeForDate(new Date("invalid"), birthdate, cap),
    null,
    "invalid gift date → null",
  );

  // Invalid birthdate → null
  assert.equal(
    yearOfLifeForDate(new Date("2010-01-01T00:00:00.000Z"), new Date("invalid"), cap),
    null,
    "invalid birthdate → null",
  );
}

function testGetAgeMilestoneState() {
  // Missing/invalid input → both gates closed, no birthday
  const empty = getAgeMilestoneState(null);
  assert.equal(empty.previewEligible, false);
  assert.equal(empty.inviteEligible, false);
  assert.equal(empty.eighteenthBirthday, null);

  const invalid = getAgeMilestoneState("not-a-date");
  assert.equal(invalid.previewEligible, false);
  assert.equal(invalid.inviteEligible, false);

  // Kid born 30 years ago → past majority, invite eligible, preview NOT
  // (preview window is age-17 → age-18 only)
  const adult = getAgeMilestoneState(new Date(Date.now() - 30 * 365.25 * 86400000));
  assert.equal(adult.inviteEligible, true, "30yo → invite eligible");
  assert.equal(adult.previewEligible, false, "30yo → past preview window");
  assert.ok(adult.eighteenthBirthday instanceof Date);

  // Kid born 5 years ago → neither eligible
  const child = getAgeMilestoneState(new Date(Date.now() - 5 * 365.25 * 86400000));
  assert.equal(child.previewEligible, false, "5yo → preview not yet eligible");
  assert.equal(child.inviteEligible, false, "5yo → invite not yet eligible");

  // Kid born 17.5 years ago → preview eligible, invite NOT
  const teen = getAgeMilestoneState(new Date(Date.now() - 17.5 * 365.25 * 86400000));
  assert.equal(teen.previewEligible, true, "17.5yo → preview eligible");
  assert.equal(teen.inviteEligible, false, "17.5yo → invite not yet");

  // Custom majority age (PA = 21) — kid born 18 years ago is NOT yet at majority
  const paKid18 = getAgeMilestoneState(new Date(Date.now() - 18 * 365.25 * 86400000), 21);
  assert.equal(paKid18.inviteEligible, false, "18yo with majority=21 → not yet");

  // Custom majority age — kid born 22 years ago IS at majority
  const paKid22 = getAgeMilestoneState(new Date(Date.now() - 22 * 365.25 * 86400000), 21);
  assert.equal(paKid22.inviteEligible, true, "22yo with majority=21 → invite eligible");

  // Out-of-range majority age clamps to 18 (defensive against bad data)
  const oddMajority = getAgeMilestoneState(new Date(Date.now() - 19 * 365.25 * 86400000), 99);
  assert.equal(oddMajority.inviteEligible, true, "19yo with majority=99 (clamped to 18) → invite eligible");
}

function main() {
  testDecideTodayParentVariant();
  console.log("✓ decideTodayParentVariant — 4 cases");

  testShouldAutoSendKidInvite();
  console.log("✓ shouldAutoSendKidInvite — 5 cases");

  testYearOfLifeForDate();
  console.log("✓ yearOfLifeForDate — 10 cases");

  testGetAgeMilestoneState();
  console.log("✓ getAgeMilestoneState — 9 cases");

  console.log("\nAll age-18 decision tests passed.");
}

main();
