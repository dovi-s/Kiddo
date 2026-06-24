// In-app embedded checkout (CHECKOUT_IN_APP_SPEC.md) feature flag, server side.
//
// DEFAULTS OFF. Gates the /api/checkout/* endpoints that back the embedded Payment
// Element (on-session deposit PaymentIntent + saved-method list). While OFF, the app
// keeps the hosted-redirect Checkout exactly as before — this is purely additive.
//
// Phase 1 (on-session, user-present deposit) carries NO legal gate. The off-session
// paths (capture-at-intent, recurring auto-pull) reuse the SAME vaulted method but stay
// behind isGifterCaptureAtIntentEnabled() + counsel. Flip to true only to exercise the
// in-app deposit preview.
export function isInAppCheckoutEnabled(): boolean {
  const flag = String(process.env.IN_APP_CHECKOUT || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}
