// Signed one-click "stop these reminders" links for reminder-only
// recurring_gifts rows (stripe_subscription_id IS NULL).
//
// Why this exists: reminder signup (POST /api/recurring-gifts) deliberately
// creates NO user account — just an email + cadence. That means the gifter
// can't magic-link into the /gifter dashboard to cancel (magic links require
// a users row), so without an in-email stop link the "Unsubscribe any time"
// promise in ReminderAndAskParentsCard had no implementing mechanism: once
// opted in, the reminders were unstoppable short of emailing support.
// (Found in the 2026-06-03 gifter recurring/reminders audit.)
//
// Design: no schema change. The link carries an HMAC-SHA256 signature over
// `${recurringGiftId}:${emailLower}` keyed by SESSION_SECRET, so it can only
// be minted by us and only stops the row it was issued for. Idempotent —
// clicking twice lands on the same "stopped" page.
import crypto from "node:crypto";

function secret(): string {
  // SESSION_SECRET is a Tier-1 launch-critical env (always set in dev+prod).
  // The dev fallback keeps local reminder emails clickable even in a stripped
  // env; it never matters in production because env.ts enforces the real one.
  return process.env.SESSION_SECRET || "kiddo-dev-reminder-stop";
}

export function reminderStopSignature(recurringGiftId: string, email: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${String(recurringGiftId)}:${String(email).trim().toLowerCase()}`)
    .digest("hex");
}

export function verifyReminderStopSignature(
  recurringGiftId: string,
  email: string,
  sig: string,
): boolean {
  const expected = reminderStopSignature(recurringGiftId, email);
  const provided = String(sig || "");
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export function buildReminderStopUrl(baseUrl: string, recurringGiftId: string, email: string): string {
  const e = String(email).trim().toLowerCase();
  return `${baseUrl}/api/recurring-gifts/${encodeURIComponent(String(recurringGiftId))}/stop?e=${encodeURIComponent(e)}&sig=${reminderStopSignature(recurringGiftId, e)}`;
}
