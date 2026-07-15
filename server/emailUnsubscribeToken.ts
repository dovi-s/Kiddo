// Signed one-click unsubscribe for PARENT promotional emails (monthly pulse,
// fund birthday, anniversary, kid milestones, holiday warmth, year-end Wrapped,
// tax-season prep, volatility reassurance). Mirrors reminderStopToken: an
// HMAC-SHA256 signature over `${emailLower}:${category}` keyed by SESSION_SECRET,
// so the link can only be minted by us and only opts out the one category it was
// issued for. No schema change — it flips the matching key in the existing
// users.email_preferences JSONB to false (REQUIRED/transactional categories
// ignore that map, so this can never suppress a password reset or gift receipt).
//
// Why this exists (2026-06-03 + 2026-06-10 email audits): parent promotional
// emails shipped with NO List-Unsubscribe header and no in-body opt-out link.
// Gmail/Yahoo require RFC 8058 one-click unsubscribe for bulk senders, and
// CAN-SPAM requires a visible unsubscribe — so without this plumbing those
// emails get spam-foldered or are non-compliant. The Settings toggles already
// existed; only the per-email link/header/endpoint were missing.
import crypto from "node:crypto";

function secret(): string {
  // SESSION_SECRET is Tier-1 launch-critical (always set in dev+prod). The dev
  // fallback keeps local unsubscribe links clickable in a stripped env; it never
  // matters in prod because env.ts enforces the real secret.
  return process.env.SESSION_SECRET || "kiddo-dev-email-unsub";
}

export function emailUnsubscribeSignature(email: string, category: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`${String(email).trim().toLowerCase()}:${String(category)}`)
    .digest("hex");
}

export function verifyEmailUnsubscribeSignature(email: string, category: string, sig: string): boolean {
  const expected = emailUnsubscribeSignature(email, category);
  const provided = String(sig || "");
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export function buildEmailUnsubscribeUrl(baseUrl: string, email: string, category: string): string {
  const e = String(email).trim().toLowerCase();
  const c = String(category);
  return `${baseUrl}/api/email/unsubscribe?e=${encodeURIComponent(e)}&cat=${encodeURIComponent(c)}&sig=${emailUnsubscribeSignature(e, c)}`;
}
