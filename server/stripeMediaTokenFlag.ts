// C3 (data-privacy audit 2026-06-09) — keep child Memory Book media URLs OUT of
// Stripe metadata.
//
// When ON, the gift-checkout path persists the gift's photo/video/audio URLs
// server-side keyed by an opaque token, passes only that token through Stripe,
// and the webhook hydrates the URLs back from the token. When OFF (the default),
// gift checkout sends the media URLs in Stripe metadata exactly as before —
// the flag is fully INERT.
//
// ⚠️ DO NOT enable in production until the smoke checklist in
// DATA_PRIVACY_AUDIT_2026-06-09.md (appendix) passes in staging, AND migration
// 0046 (pending_gift_media) has been applied. The write path degrades
// gracefully (falls back to legacy metadata on any persist failure), but the
// minimization is only achieved once both the migration and the flag are live
// and a real gift with media has been verified end-to-end.
export function isStripeMediaTokenEnabled(): boolean {
  const flag = String(process.env.STRIPE_MEDIA_TOKEN_ENABLED || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
